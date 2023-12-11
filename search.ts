import { parse, stringify } from "csv";
import * as fs from 'fs';
import { exit } from "process";

const url = 'wss://domains-ws.revved.com/v1/ws?batch=true&trace=true';
interface DomainStatusRequest {
  type: 'domainStatus';
  reqID: string;
  data: {
    domains: string[];
  }
}

interface DomainStatusResponse {
  type: 'domainStatusResponse';
  reqID: string;
  data: {
    name: string;
    error?: string;
    available?: boolean;
    lookupType?: string;
    whois?: {
      createdYear: number
    }
  }
}

interface Definition {Domain: string, Word: string, Definition: string};

parse(fs.readFileSync('filtered-words.csv'), {columns: true}, (err, defs: Definition[]) => {
  if(err) throw err;

  // Replace all Domains
  defs = defs.map(def => ({...def, Domain: def.Word + '.net'}));

  // Start partway into list
  const start = "pouna.net";
  const startIndex = defs.findIndex(def => def.Domain === start);
  if(startIndex === -1) throw new Error(`Could not find ${start}`);
  defs = defs.slice(startIndex);

  // Break into batches
  const batches: Definition[][] = [];
  const defsCopy = [...defs];
  while(defsCopy.length > 0) {
    batches.push(defsCopy.splice(0, 500));
  }
  
  // Create a websocket connection
  const ws = new WebSocket(url);
  ws.onopen = () => {
    console.log('Connected to websocket');
    // Send each batch with 1 second in between
    let i = 0;
    const interval = setInterval(() => {
      if(i >= batches.length) {
        clearInterval(interval);
        return;
      }
      sendBatch(ws, batches[i]);
      i++;
    }, 4000);    
  };

  // Listen for responses
  let numResponses = 0;
  const availableDomains: Definition[] = [];
  const csvWriter = stringify({ header: true });
  csvWriter.pipe(fs.createWriteStream('available-domains.csv', {flags: 'a'})); 
  ws.onmessage = (event) => {
    try {
      const res: DomainStatusResponse = JSON.parse(event.data);
      if(res.type === 'domainStatusResponse') {
        numResponses++;
        if (res.data.available) {
          const def = defs.find(def => def.Domain === res.data.name);
          if(def) {
            availableDomains.push(def);
            console.log(`✅ ${def.Domain}`);
            csvWriter.write(def);
          }
        } else {
          console.log(`❌ ${res.data.name}`);
        }
        if(numResponses === defs.length) {
          ws.close();
        }
      }
    } catch(e) {
      console.log(`⛔️ Error parsing response`, event);
      exit(1);
    }
  };

  ws.onclose = () => {
    console.log('Websocket closed')
    csvWriter.end();
  };
});

const sendBatch = (ws: WebSocket, batch: Definition[]) => {
  const req: DomainStatusRequest = {
    type: 'domainStatus',
    reqID: new Date().getTime().toString(),
    data: {
      domains: batch.map(def => def.Domain)
    }
  };
  console.log(`Sending batch of ${batch.length} domains starting with ${batch[0].Domain}`)
  ws.send(JSON.stringify(req));
}