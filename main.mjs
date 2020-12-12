import fs from 'fs'

import { federalUnits } from './constants.mjs'
import getCepRanges from './getCepRanges.mjs'
import searchAndStoreValidCeps from './searchAndStoreValidCeps.mjs'
import getGeoCoords from './getGeoCoords.mjs'
import { log }  from './logger.mjs'

async function computeCepRanges() {
  console.log(`---------- COMPUTING CEP RANGES ----------\n`)
  for (const unit of federalUnits) {
    try {
      console.log(`\t- ${unit}`)
      await getCepRanges(unit)
    } catch (err) {
      console.error(err)
    }
  }
}

function hasRecovery(){
  return fs.existsSync('recovery.json')
}

function getRecovery(){
  const json = fs.readFileSync('recovery.json','utf8')
  return JSON.parse(json)
}

async function computeValidCeps() {
  console.log(`---------- COMPUTING VALID CEPS ----------\n`)
  function readFile() {
    const file = fs.readFileSync('ranges.csv', { encoding: 'utf8', flag: 'r' })
    const csvFile = file.split('\n').map(line => {
      const [uf, start, end] = line.split(',')
      return { uf, start, end }
    })
    return csvFile
  }

  let indexRange = 0
  let isRecovery = false
  let lastIndex = -1

  if(hasRecovery()){
    const data = getRecovery()

    indexRange = data.indexRange
    lastIndex = data.lastIndex
    isRecovery = true
    fs.unlinkSync('recovery.json')
  }

  const rangeList = readFile()

  // Remove blank line
  rangeList.pop()

  for (; indexRange < rangeList.length; indexRange++) {
    try {
      const range = rangeList[indexRange]

      log.info(`\t${range.uf} | ${range.start} - ${range.end} | ${indexRange + 1}/${rangeList.length}`)
      await searchAndStoreValidCeps({range, indexRange, isRecovery, lastIndex})
      isRecovery = false
    } catch (err) {
      console.error(err)
    }
  }
}

async function computeGeoCoords() {
  console.log(`---------- COMPUTING GEOCOORDS ----------\n`)
  function readFile() {
    const file = fs.readFileSync('valid_ceps.csv', { encoding: 'utf8', flag: 'r' })
    const csvFile = file.split('\n').map(line => {
      const [cep, state, city, street] = line.split(',')
      return { cep, state, city, street }
    })
    return csvFile
  }

  const addressList = readFile()

  // Remove blank line
  addressList.pop()

  try {
    await getGeoCoords(addressList)
  } catch (err) {
    console.error(err)
  }
}

async function run() {
  if (process.argv.some(arg => arg === 'compute-cep-ranges')) {
    await computeCepRanges()
  }

  if (process.argv.some(arg => arg === 'compute-valid-ceps')) {
    await computeValidCeps()
  }

  if (process.argv.some(arg => arg === 'compute-geocoords')) {
    await computeGeoCoords()
  }

  console.log('Finished')
}

run().catch(err => console.error(err))
