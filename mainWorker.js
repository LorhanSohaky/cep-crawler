const { parentPort, Worker } = require('worker_threads')
const dns = require('dns').promises

const log = require('simple-node-logger').createSimpleLogger('output.log')

const STATUS = {
  AVAILABLE: 'available',
  BUSY: 'busy'
}

let queue = []
let pending_queue = []
let lastIndex = -1

function create_consumers(total, listener) {
  const consumers = []

  for (let i = 0; i < total; i++) {
    const worker = new Worker('./worker.mjs')
    worker.addListener('message', listener)
    worker.addListener('error', e => console.error(e))
    consumers.push({ id: i + 1, worker, status: STATUS.AVAILABLE })
  }

  return consumers
}

const get_next = (consumer) => {
  if (queue.length > 0 && consumer.status === STATUS.AVAILABLE) {
    const data = queue.shift()
    lastIndex++
    pending_queue.push(data)
    consumer.status = STATUS.BUSY
    consumer.worker.postMessage({id:consumer.id,data})
  } else if (queue.length === 0) {
    exit(consumer)
    if (consumers.filter(item => item.status === STATUS.BUSY).length === 0) {
      parentPort.removeAllListeners()
    }
  } else {
    console.warn('Deadlock?')
  }
}

const exit = (consumer) => {
  consumer.worker.removeAllListeners()
  consumer.worker.terminate()
}

const retry_connection = async() => {
  return new Promise((resolve,reject) => {
    let interval = setInterval(() => {
      log.warn('Retrying connection')
      dns.resolve('brasilapi.com.br').then(() => {
        clearInterval(interval)
        log.info('Connection reestablished')
        resolve() 
      }).catch(() => null)
    },60000) 
  })
}

const on_finish = async ({id,data,cep, error}) => {
    const consumer = consumers[id - 1]
    
      if (error!== undefined) {
        lastIndex--
        queue.push(cep)
        if(error !== 'invalid-json' && error!== 'aborted') {
          await retry_connection()
        }
      } else if (!error) {
        parentPort.postMessage({ id,data, status: 'finished' })
      }

      pending_queue = pending_queue.filter(pending => pending !== cep)

      consumer.status = STATUS.AVAILABLE
      get_next(consumer)
}


const consumers = create_consumers(15, on_finish)

parentPort.addListener('message', ({ action, list }) => {
  if (action === 'push') {
    lastIndex = -1
    queue = [...queue, ...list]
    consumers.filter(({ status }) => status === STATUS.AVAILABLE).forEach(consumer => get_next(consumer))
  } else if (action === 'SIGINT') {
    consumers.forEach(consumer => {
      consumer.worker.removeAllListeners()
      consumer.worker.terminate()
    })

    queue.sort()
    pending_queue.sort()
    let lastItem = Math.min(
      isNaN(queue[0])? Infinity : queue[0],
      isNaN(pending_queue[0])? Infinity : pending_queue[0]
    ).toString()


    parentPort.postMessage({ id: -1, status:'SIGINT', data:{ lastIndex:lastItem }})
  } else {
    log.error(`Push action expected`)
  }

})
