import { Worker } from 'worker_threads'
import fs from 'fs'

import CsvWriter from 'csv-writer'

const createCsvWriter = CsvWriter.createObjectCsvWriter

let worker = undefined

process.on('SIGINT', (code) => {
  worker.postMessage({action: 'SIGINT'})
})


const csvConfigs = {
  path: 'valid_ceps.csv',
  append: true,
  header: [
    { id: 'cep', title: 'cep' },
    { id: 'state', title: 'state' },
    { id: 'city', title: 'city' },
    { id: 'street', title: 'street' },
  ]
}
const CEP_MASK = '00000000'

const csvWriter = createCsvWriter(csvConfigs)

function formatCep(cep) {
  const sanitizedCep = cep.replace(/\D/g, '')

  return (CEP_MASK + `${parseInt(sanitizedCep)}`).slice(-CEP_MASK.length)
}

function increaseCep(cep) {
  return formatCep(`${parseInt(cep) + 1}`)
}


export default async function searchAndStoreValidCeps({range, indexRange, isRecovery, lastIndex}) {
  worker = new Worker('./mainWorker.js')

  async function storeValidCeps () {
    await csvWriter.writeRecords(validCeps)
  }

  const start = formatCep(range.start)
  const end = formatCep(range.end)

  const ceps = []
  const validCeps = []
  let cepIsFound = false

  for (let i = start, index = 0; i !== end; i = increaseCep(i), index++) {
    if (isRecovery && !cepIsFound) {
      if (i.localeCompare(lastIndex) === 0) {
        console.log('Achei')
        cepIsFound = true
      } else {
        continue
      }
    }

    ceps.push(i)
  }

  worker.addListener('message', async ({ status, data }) => {
    if (data && status === 'finished') {
      validCeps.push(data)
      if(validCeps.length >=100) {
        await csvWriter.writeRecords(validCeps.splice(0,100))
      }
    } else if (status === 'SIGINT') {
      const { lastIndex } = data

      worker.removeAllListeners()
      worker.terminate()

      await storeValidCeps()
      fs.writeFileSync('recovery.json', JSON.stringify({method:'searchAndStoreValidCeps',indexRange,lastIndex}), 'utf8')

      process.exit()
    }
  })

  worker.postMessage({ action: 'push', list: ceps })

  return new Promise((resolve, reject) => {
    worker.on('exit', async() => {
      worker.removeAllListeners()
   
      await storeValidCeps()

      resolve()
    })
  })
}
