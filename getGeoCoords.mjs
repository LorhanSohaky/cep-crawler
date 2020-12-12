import fetch from 'node-fetch'
import CsvWriter from 'csv-writer'
import ChunkPromise from 'chunk-promise'
import https from 'https'

import { concurrent } from './constants.mjs'

const { chunkPromise, PromiseFlavor } = ChunkPromise

const createCsvWriter = CsvWriter.createObjectCsvWriter

const csvConfigs = {
  path: 'ceps_with_coords.csv',
  append: true,
  header: [
    { id: 'cep', title: 'cep' },
    { id: 'state', title: 'state' },
    { id: 'city', title: 'city' },
    { id: 'street', title: 'street' },
    { id: 'latitude', title: 'latitude' },
    { id: 'longitude', title: 'longitude' }
  ]
}

const csvWriter = createCsvWriter(csvConfigs)

export default async function getGeoCoords(addressList) {
  let promiseArray = []

  for (const address of addressList) {
    console.log(`\t- ${address.cep}`)
    promiseArray.push(() => fetchData(address))

    if (promiseArray.length === concurrent) {
      const promises = await chunkPromise(promiseArray, {
        concurrent,
        promiseFlavor: PromiseFlavor.PromiseAllSettled
      })

      const resolvedPromises = promises
        .filter(({ status }) => status !== 'rejected')

      const rejectedPromises = promises
        .filter(({ status }) => status === 'rejected')

      if (rejectedPromises.length) {
        console.warn(rejectedPromises)
      }

      if (resolvedPromises.length) {
        const values = resolvedPromises.map(promise => promise.value)

        await csvWriter.writeRecords(values)
      }

      promiseArray = []
    }
  }
}

const agent = new https.Agent({keepAlive:true})


async function fetchData({ cep, state, city, street }) {
  const encodedState = encodeURI(state)
  const encodedCity = encodeURI(city)
  const encodedStreet = encodeURI(street)

  const country = 'Brasil'
  const queryString = `format=json&addressdetails=1&country=${country}&state=${encodedState}&city=${encodedCity}&street=${encodedStreet}&limit=1`

  const response = await fetch(`https://nominatim.openstreetmap.org/search/?${queryString}`)

  const jsonData = await response.json()

  if(jsonData.length > 0){
    const { lat: latitude, lon: longitude } = jsonData[0]
    return { cep, state, city, street, latitude, longitude }
  }

  return { cep, state, city, street, latitude:undefined, longitude:undefined }

}