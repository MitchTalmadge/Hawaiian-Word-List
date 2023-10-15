import { load } from 'cheerio';
import { createObjectCsvWriter } from 'csv-writer';

const letters = ['a', 'e', 'h', 'i', 'k', 'l', 'm', 'n', 'o', 'p', 'u', 'w'];

const getDefinitions = async (url: string) => {
  console.log("Loading URL: ", url);
  const response = await fetch(url);
  console.log("Loaded");
  const data = await response.text();
  console.log("Parsing");
  const $ = load(data);
  const hwTags = $('html > body > table > tbody > tr > td > p.hw');
  console.log("Parsed: ", hwTags.length);

  const definitions = hwTags.map((i, el) => {
    const word = $(el).find('span.HwNew > a.hw').text();
    if(!word) return;
    const definition = $(el).find('span.def').text();
    return { word, definition };
  }).get();
  return definitions
}

const definitions = 
  (await Promise.all(
    letters.map(
      letter => getDefinitions(`https://www.trussel2.com/HAW/haw-${letter}.htm`))))
      .flat();

const csvWriter = createObjectCsvWriter({
  path: 'hawaiian-words.csv',
  header: [
    { id: 'word', title: 'Word' },
    { id: 'definition', title: 'Definition' },
  ],
});

await csvWriter.writeRecords(definitions);