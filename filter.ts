import * as fs from 'fs';
import { parse, stringify } from 'csv';

interface Definition {
  Word: string;
  Definition: string;
}

const tlds = fs.readFileSync('tlds.txt').toString().split('\n');
const hawaiianTlds = tlds
  .map(tld => tld.toLowerCase())
  .filter(tld => tld.length <= 4)
  .filter(tld => tld.match(/^[aeiouhklmnpw]+$/))
  .filter(tld => {
    // Every consonant must be followed by a vowel
    let lastWasConsonant = false;
    for(const char of tld) {
      if(lastWasConsonant && !char.match(/[aeiou]/)) return false;
      lastWasConsonant = !char.match(/[aeiou]/);
    }
    return !lastWasConsonant;
  });

console.log(hawaiianTlds);

const tldsRegex = new RegExp(`(${hawaiianTlds.join('|')})$`, 'i');
console.log(tldsRegex.source)

parse(fs.readFileSync('hawaiian-words.csv'), {columns: true}, (err, defs: Definition[]) => {
  if(err) throw err;

  let filteredDefs = defs
    .map(def => ({ Word: def.Word.toLowerCase(), Definition: def.Definition }))
    .filter(def => !def.Word.match(/[ʻāēīōū\-]/));

  // Remove duplicates
  filteredDefs = filteredDefs.filter((def, i) => filteredDefs.findIndex(d => d.Word === def.Word) === i);
  let parsedDefs = filteredDefs.map(def => {
    const tld = def.Word.match(tldsRegex)?.[0];
    if(!tld) {
      console.log(`No tld for ${def.Word}`);
      return;
    }
    console.log(`tld for ${def.Word}: ${tld}`)
    let domain = def.Word.substring(0, def.Word.length - tld.length);
    domain = domain.replaceAll(' ', '-');
    if(domain.endsWith('-')) domain = domain.substring(0, domain.length - 1);
    if(domain.length == 0) return;
    if(domain.includes('-')) return;
    domain = domain + '.' + tld;
    return { Domain: domain, Word: def.Word, Definition: def.Definition, TLD: tld };
  })
  .filter(def => def !== undefined)

  const csvWriter = stringify({ header: true });
  csvWriter.pipe(fs.createWriteStream('filtered-words.csv')); 
  parsedDefs.forEach(def => csvWriter.write(def));
  csvWriter.end();

  const justDomains = parsedDefs.map(def => def.Domain);
  const onePerLine = justDomains.join('\n');
  fs.writeFileSync('filtered-domains.txt', onePerLine);
});

