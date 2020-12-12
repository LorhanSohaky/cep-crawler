import fetch from 'node-fetch'
import CsvWriter from 'csv-writer'

const createCsvWriter = CsvWriter.createObjectCsvWriter

const csvConfigs = {
  path: 'ranges.csv',
  append: true,
  header: [
    {
      id: 'unit',
      title: 'unit'
    },
    {

      id: 'start',
      title: 'start'
    },
    {
      id: 'end',
      title: 'end'
    },

  ]
}

const csvWriter = createCsvWriter(csvConfigs);

export default async function getCepRanges(federalUnit) {
  const regex = /<td width="80"> (\d{5}-\d{3}) a (\d{5}-\d{3})<\/td>/gm

  let match
  const ranges = []

  const body = await fetchData(federalUnit)

  while ((match = regex.exec(body)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }
    ranges.push({
      unit: federalUnit,
      start: match[1],
      end: match[2]
    })

  }

  await csvWriter.writeRecords(ranges)

  return ranges
}

async function fetchData(federalUnit) {
  const response = await fetch('http://www.buscacep.correios.com.br/sistemas/buscacep/resultadoBuscaFaixaCEP.cfm', {
    'credentials': 'include',
    'headers': {
      'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:78.0) Gecko/20100101 Firefox/78.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-BR,en-US;q=0.7,en;q=0.3',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Upgrade-Insecure-Requests': '1'
    },
    'referrer': 'http://www.buscacep.correios.com.br/sistemas/buscacep/buscaFaixaCep.cfm',
    'body': `UF=${federalUnit}&Localidade=`,
    'method': 'POST',
    'mode': 'cors'
  });

  return response.text()
}