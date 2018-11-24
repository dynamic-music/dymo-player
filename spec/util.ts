const fetch = require('node-fetch');
import { DymoManager, Fetcher } from 'dymo-core';

class NodeFetcher implements Fetcher {
  async fetchText(url: string) {
    //console.log('fetching', url)
    return fetch(url).then(r => r.text());
  }
  async fetchJson(url: string) {
    return fetch(url).then(r => r.json());
  }
  async fetchArrayBuffer(url: string) {
    return fetch(url).then(r => r.arrayBuffer());
  }
}

export async function getStoreWithDymo() {
  //(1:(2:5,6),(3:7,(8:11,12),9),(4:10)))
  const store = new DymoManager(null, new NodeFetcher()).getStore();
  await store.loadOntologies();
  await store.addDymo("dymo1");
  await store.addDymo("dymo2", "dymo1");
  await store.addDymo("dymo3", "dymo1");
  await store.addDymo("dymo4", "dymo1");
  await store.addDymo("dymo5", "dymo2");
  await store.addDymo("dymo6", "dymo2");
  await store.addDymo("dymo7", "dymo3");
  await store.addDymo("dymo8", "dymo3");
  await store.addDymo("dymo9", "dymo3");
  await store.addDymo("dymo10", "dymo4");
  await store.addDymo("dymo11", "dymo8");
  await store.addDymo("dymo12", "dymo8");
  /*await store.addSimilar("dymo5", "dymo7");
  await store.addSimilar("dymo7", "dymo5");
  await store.addSimilar("dymo6", "dymo9");
  await store.addSimilar("dymo8", "dymo10");
  await store.addSimilar("dymo10", "dymo6");*/
  return store;
}