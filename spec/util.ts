const fetch = require('node-fetch');
import { DymoManager, Fetcher } from 'dymo-core';

class NodeFetcher implements Fetcher {
  async fetchText(url: string) {
    console.log('fetch text', url);
    return fetch(url).then(r => r.text());
    //return '';
  }
  async fetchJson(url: string) {
    console.log('fetch json', url);
    return '';
  }
  async fetchArrayBuffer(url: string) {
    console.log('fetch buffer', url);
    return new ArrayBuffer(0);
  }
}

export async function getStoreWithDymo() {
  //(1:(2:5,6),(3:7,(8:11,12),9),(4:10)))
  const store = new DymoManager(null, new NodeFetcher()).getStore();
  await store.loadOntologies();
  store.addDymo("dymo1");
  store.addDymo("dymo2", "dymo1");
  store.addDymo("dymo3", "dymo1");
  store.addDymo("dymo4", "dymo1");
  store.addDymo("dymo5", "dymo2");
  store.addDymo("dymo6", "dymo2");
  store.addDymo("dymo7", "dymo3");
  store.addDymo("dymo8", "dymo3");
  store.addDymo("dymo9", "dymo3");
  store.addDymo("dymo10", "dymo4");
  store.addDymo("dymo11", "dymo8");
  store.addDymo("dymo12", "dymo8");
  /*store.addSimilar("dymo5", "dymo7");
  store.addSimilar("dymo7", "dymo5");
  store.addSimilar("dymo6", "dymo9");
  store.addSimilar("dymo8", "dymo10");
  store.addSimilar("dymo10", "dymo6");*/
  return store;
}