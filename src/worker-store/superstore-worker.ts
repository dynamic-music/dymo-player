import * as registerPromiseWorker from 'promise-worker/register';
import { SuperStore } from 'dymo-core';

declare var self;

const OBSERVER_FUNCS = ["addValueObserver", "addTypeObserver",
  "addParameterObserver", "removeParameterObserver",
  "addPartsObserver", "removePartsObserver"];

const store = new SuperStore();

registerPromiseWorker(message => {
  if (OBSERVER_FUNCS.indexOf(message.function) >= 0) {
    message.args[message.args.length-1] = self;
  }
  return store[message.function](...message.args);
});

self.observedValueChanged = function(paramUri: string, paramType: string, value: number) {
  self.postMessage({paramUri: paramUri, paramType: paramType, value: value});
}

self.observedPartsChanged = function(dymoUri: string) {
  self.postMessage({dymoUri: dymoUri});
}