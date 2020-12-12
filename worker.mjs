import { parentPort } from 'worker_threads'

import AbortController from "abort-controller"
import https from 'https'
import fetch from 'node-fetch'

// import cepPromise from 'cep-promise'

import { log } from './logger.mjs'

const httpsAgent = new https.Agent({
   keepAlive: true
 })

async function fetchData(cep) {
  const controller = new AbortController()
  const signal = controller.signal
  const timeout = setTimeout(() => controller.abort(), 20000)

  const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`,{
    headers: {
      'Accept':'application/json',
    },
    agent: httpsAgent,
    signal
  })

  clearTimeout(timeout)

  const data = await response.json()

  if (data.name === 'CepPromiseError') {
   return undefined 
  }

  // try{
  //   return await cepPromise(cep, {agent: httpsAgent})
  // }catch(err){
  //   if(err.name==='CepPromiseError'){
  //     return undefined
  //   }else {
  //     throw err
  //   }
  // }
}

parentPort.addListener('message', ({id, data}) => {
  fetchData(data)
    .then(result => {
      parentPort.postMessage({ id,cep:data, data: result })
    })
    .catch(err => {
      log.error(`${data}: ${err.message}`)
      parentPort.postMessage({ id, cep:data, data, error:err.type })
    })
})
