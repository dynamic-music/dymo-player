import * as SuperStoreWorker from "worker-loader!./superstore-worker";
import * as PromiseWorker from 'promise-worker';
import { Fetcher, Observer, JsonGraph, SuperDymoStore, ConstraintGhost,
  BoundVariableGhost, AttributeInfo } from 'dymo-core';

export class WorkerStoreService implements SuperDymoStore {

  private worker: PromiseWorker;
  private observers = new Map<string, Observer[]>();

  constructor(fetcher?: Fetcher) {
    this.worker = new PromiseWorker(new SuperStoreWorker());//new Worker(workerPath);
    this.worker._worker.addEventListener('message', this.notifyObservers.bind(this));
    if (fetcher) {
      this.worker.postMessage({function:'setFetcher', args:[fetcher]});
    }
  }

  ////// CONSTRAINT FUNCTIONS ///////

  addConstraint(ownerUri: string, constraint: ConstraintGhost): Promise<string> {
    return this.worker.postMessage({function:'addConstraint', args:[ownerUri, constraint]});
  }

  addVariable(variable: BoundVariableGhost): Promise<string> {
    return this.worker.postMessage({function:'addVariable', args:[variable]});
  }

  activateNewConstraints(constraintUris: string[]): Promise<string[]> {
    return this.worker.postMessage({function:'activateNewConstraints', args:[constraintUris]});
  }

  deactivateConstraints(constraintUris: string[]) {
    return this.worker.postMessage({function:'deactivateConstraints', args:[constraintUris]});
  }



  ////// DYMOSTORE FUNCTIONS ////////

  loadOntologies(localPath?: string): Promise<any> {
    return this.worker.postMessage({function:'loadOntologies', args:[localPath]});
  }

  addBasePath(dymoUri: string, path: string) {
    return this.worker.postMessage({function:'addBasePath', args:[dymoUri, path]});
  }

  async addParameterObserver(dymoUri: string, parameterType: string, observer: Observer): Promise<string> {
    const paramUri = await this.worker.postMessage({function:'addParameterObserver', args:[dymoUri, parameterType, null]});
    this.addObserver(observer, paramUri);
    return paramUri;
  }

  async removeParameterObserver(dymoUri: string, parameterType: string, observer: Observer): Promise<string> {
    const paramUri = await this.worker.postMessage({function:'removeParameterObserver', args:[dymoUri, parameterType, null]});
    this.removeObserver(observer, paramUri);
    return paramUri;
  }

  addTypeObserver(type: string, observer: Observer) {
    this.addObserver(observer, type);
    return this.worker.postMessage({function:'addTypeObserver', args:[type, null]});
  }

  addRendering(renderingUri: string, dymoUri: string) {
    return this.worker.postMessage({function:'addRendering', args:[renderingUri, dymoUri]});
  }

  addDymo(dymoUri: string, parentUri?: string, partUri?: string, sourcePath?: string, type?: string): Promise<string> {
    return this.worker.postMessage({function:'addDymo', args:[dymoUri, parentUri, partUri, sourcePath, type]});
  }

  findTopDymos(): Promise<string[]> {
    return this.worker.postMessage({function:'findTopDymos', args:[]});
  }

  findAllObjectsInHierarchy(dymoUri: string): Promise<string[]> {
    return this.worker.postMessage({function:'findAllObjectsInHierarchy', args:[dymoUri]});
  }

  addPart(dymoUri: string, partUri: string): Promise<void> {
    return this.worker.postMessage({function:'addPart', args:[dymoUri, partUri]});
  }

  insertPartAt(dymoUri: string, partUri: string, index: number): Promise<void> {
    return this.worker.postMessage({function:'insertPartAt', args:[dymoUri, partUri, index]});
  }

  removeParts(dymoUri: string, index?: number): Promise<string[]> {
    return this.worker.postMessage({function:'removeParts', args:[dymoUri, index]});
  }

  findParts(dymoUri: string): Promise<string[]> {
    return this.worker.postMessage({function:'findParts', args:[dymoUri]});
  }

  findPartAt(dymoUri, index): Promise<string> {
    return this.worker.postMessage({function:'findPartAt', args:[dymoUri, index]});
  }

  findAllParents(dymoUri: string): Promise<string[]> {
    return this.worker.postMessage({function:'findAllParents', args:[dymoUri]});
  }

  getSourcePath(dymoUri: string): Promise<string> {
    return this.worker.postMessage({function:'getSourcePath', args:[dymoUri]});
  }

  addControl(name: string, type: string, uri?: string): Promise<string> {
    return this.worker.postMessage({function:'addControl', args:[name, type, uri]});
  }

  setParameter(ownerUri: string, parameterType: string, value?: any): Promise<string> {
    return this.worker.postMessage({function:'setParameter', args:[ownerUri, parameterType, value]});
  }

  findParameterValue(ownerUri: string, parameterType: string): Promise<any> {
    return this.worker.postMessage({function:'findParameterValue', args:[ownerUri, parameterType]});
  }

  addCustomParameter(ownerUri: string, paramType: string): Promise<string> {
    return this.worker.postMessage({function:'addCustomParameter', args:[ownerUri, paramType]});
  }

  setFeature(ownerUri: string, featureType: string, value?: any): Promise<string> {
    return this.worker.postMessage({function:'setFeature', args:[ownerUri, featureType, value]});
  }

  findFeatureValue(ownerUri: string, featureType: string): Promise<any> {
    return this.worker.postMessage({function:'findFeatureValue', args:[ownerUri, featureType]});
  }

  findAttributeValue(ownerUri: string, attributeType: string): Promise<any> {
    return this.worker.postMessage({function:'findAttributeValue', args:[ownerUri, attributeType]});
  }

  async setControlParam(controlUri: string, parameterType: string, value: any, observer?: Observer): Promise<string> {
    const paramUri = await this.worker.postMessage({function:'setControlParam', args:[controlUri, parameterType, value, observer]});
    if (observer) {
      this.addObserver(observer, paramUri);
    }
    return paramUri;
  }

  findControlParamValue(controlUri: string, parameterType: string): Promise<any> {
    return this.worker.postMessage({function:'findControlParamValue', args:[controlUri, parameterType]});
  }

  addNavigator(renderingUri: string, navigatorType: string, variableUri: string): Promise<string> {
    return this.worker.postMessage({function:'addNavigator', args:[renderingUri, navigatorType, variableUri]});
  }

  getAttributeInfo(): Promise<AttributeInfo[]> {
    return this.worker.postMessage({function:'getAttributeInfo', args:[]});
  }

  findMaxLevel(dymoUri?: string): Promise<number> {
    return this.worker.postMessage({function:'findMaxLevel', args:[dymoUri]});
  }

  toJsonGraph(nodeClass, edgeProperty, previousGraph?: JsonGraph): Promise<JsonGraph> {
    return this.worker.postMessage({function:'toJsonGraph',
      args:[nodeClass, edgeProperty, previousGraph]});
  }

  uriToJsonld(frameUri: string): Promise<string> {
    return this.worker.postMessage({function:'uriToJsonld', args:[frameUri]});
  }



  ////// EASYSTORE FUNCTIONS /////////

  addValueObserver(subject: string, predicate: string, observer: Observer) {
    const key = this.addObserver(observer, subject);
    return this.worker.postMessage({function:'addValueObserver', args:[subject, predicate, key]});
  }

  getValueObserverCount(): Promise<number> {
    return this.worker.postMessage({function:'getValueObserverCount', args:[]});
  }

  size(): Promise<number> {
    return this.worker.postMessage({function:'size', args:[]});
  }

  setValue(subject: string, predicate: string, value: any) {
    return this.worker.postMessage({function:'setValue', args:[subject, predicate, value]});
  }

  findSubject(predicate: string, object: any): Promise<string> {
    return this.worker.postMessage({function:'findSubject', args:[predicate, object]});
  }

  findSubjects(predicate: string, object: any): Promise<string[]> {
    return this.worker.postMessage({function:'findSubjects', args:[predicate, object]});
  }

  findObject(subject: string, predicate: string): Promise<string> {
    return this.worker.postMessage({function:'findObject', args:[subject, predicate]});
  }

  findAllObjects(subject: string, predicate: string): Promise<string[]> {
    return this.worker.postMessage({function:'findAllObjects', args:[subject, predicate]});
  }

  findObjectValue(subject: string, predicate: string): Promise<any> {
    return this.worker.postMessage({function:'findObjectValue', args:[subject, predicate]});
  }

  isSubclassOf(class1: string, class2: string): Promise<boolean> {
    return this.worker.postMessage({function:'isSubclassOf', args:[class1, class2]});
  }

  recursiveFindAllSubClasses(superclassUri: string): Promise<string[]> {
    return this.worker.postMessage({function:'recursiveFindAllSubClasses', args:[superclassUri]});
  }

  addTriple(subject: string, predicate: string, object: string): Promise<void> {
    return this.worker.postMessage({function:'addTriple', args:[subject, predicate, object]});
  }

  loadData(data: string): Promise<any> {
    return this.worker.postMessage({function:'loadData', args:[data]});
  }

  logData(): Promise<any> {
    return this.worker.postMessage({function:'logData', args:[]});
  }



  ////// PRIVATE FUNCTIONS

  private addObserver(observer: Observer, uriOrType: string): void {
    if (!this.observers.has(uriOrType)) {
      this.observers.set(uriOrType, []);
    }
    this.observers.get(uriOrType).push(observer);
  }

  private removeObserver(observer: Observer, uriOrType: string): void {
    const observers = this.observers.get(uriOrType);
    if (observers) {
      observers.slice(observers.indexOf(observer), 1);
      if (observers.length == 0) {
        this.observers.delete(uriOrType);
      }
    }
  }

  private notifyObservers(event) {
    if (event.data.paramUri) {
      let observers = this.getObservers(event.data.paramUri)
        .concat(this.getObservers(event.data.paramType));
      //console.log("NOTIFIED", event.data, observers);
      observers.forEach(o => o.observedValueChanged(event.data.paramUri, event.data.paramType, event.data.value));
    }
  }

  private getObservers(uriOrType: string): Observer[] {
    let observers = this.observers.get(uriOrType);
    return observers ? observers : [];
  }

}