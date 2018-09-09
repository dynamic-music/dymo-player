import * as SuperStoreWorker from "worker-loader!./superstore-worker";
import * as PromiseWorker from 'promise-worker';
import { Fetcher, Observer, ValueObserver, PartsObserver, JsonGraph,
  SuperDymoStore, ConstraintGhost, BoundVariableGhost, AttributeInfo } from 'dymo-core';

export class WorkerStoreService implements SuperDymoStore {

  private worker: PromiseWorker;
  private observers = new Map<string, Observer[]>();
  private paramUris = new Map<string, string>();

  constructor(fetcher?: Fetcher) {
    this.worker = new PromiseWorker(new SuperStoreWorker());//new Worker(workerPath);
    this.worker._worker.addEventListener('message', this.notifyObservers.bind(this));
    if (fetcher) {
      //TODO doesn't work of course..
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

  deactivateConstraints(constraintUris: string[]): Promise<void> {
    return this.worker.postMessage({function:'deactivateConstraints', args:[constraintUris]});
  }

  getActiveConstraintCount(): Promise<number> {
    return this.worker.postMessage({function:'getActiveConstraintCount', args:[]});
  }



  ////// DYMOSTORE FUNCTIONS ////////

  loadOntologies(localPath?: string): Promise<any> {
    return this.worker.postMessage({function:'loadOntologies', args:[localPath]});
  }

  addBasePath(dymoUri: string, path: string) {
    return this.worker.postMessage({function:'addBasePath', args:[dymoUri, path]});
  }

  async addParameterObserver(dymoUri: string, parameterType: string, observer: ValueObserver): Promise<string> {
    const paramUri = await this.worker.postMessage({function:'addParameterObserver', args:[dymoUri, parameterType, null]});
    this.paramUris.set(dymoUri+parameterType, paramUri);
    this.addObserver(observer, paramUri);
    return paramUri;
  }

  async removeParameterObserver(dymoUri: string, parameterType: string, observer: ValueObserver): Promise<string> {
    const paramUri = this.paramUris.get(dymoUri+parameterType);
    if (this.removeObserver(observer, paramUri)) {
      //none left for this paramUri
      await this.worker.postMessage({function:'removeParameterObserver', args:[dymoUri, parameterType, null]});
    }
    return paramUri;
  }

  addPartsObserver(dymoUri: string, observer: PartsObserver) {
    this.addObserver(observer, dymoUri);
    return this.worker.postMessage({function:'addPartsObserver', args:[dymoUri, null]});
  }

  removePartsObserver(dymoUri: string, observer: PartsObserver) {
    if (this.removeObserver(observer, dymoUri)) {
      //none left for this dymoUri
      return this.worker.postMessage({function:'removePartsObserver', args:[dymoUri, null]});
    }
  }

  addRendering(renderingUri: string, dymoUri: string) {
    return this.worker.postMessage({function:'addRendering', args:[renderingUri, dymoUri]});
  }

  addDymo(dymoUri: string, parentUri?: string, partUri?: string, sourcePath?: string, type?: string): Promise<string> {
    return this.worker.postMessage({function:'addDymo', args:[dymoUri, parentUri, partUri, sourcePath, type]});
  }

  removeDymo(dymoUri: string) {
    return this.worker.postMessage({function:'removeDymo', args:[dymoUri]});
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

  getAllSourcePaths(): Promise<string[]> {
    return this.worker.postMessage({function:'getAllSourcePaths', args:[]});
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

  async setControlParam(controlUri: string, parameterType: string, value: any): Promise<string> {
    return this.worker.postMessage({function:'setControlParam', args:[controlUri, parameterType, value]});
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
    this.addObserver(observer, subject);
    return this.worker.postMessage({function:'addValueObserver', args:[subject, predicate, null]});
  }

  addTypeObserver(type: string, observer: ValueObserver) {
    this.addObserver(observer, type);
    return this.worker.postMessage({function:'addTypeObserver', args:[type, null]});
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

  findAllObjectValues(subject: string, predicate: string): Promise<any[]> {
    return this.worker.postMessage({function:'findAllObjectValues', args:[subject, predicate]});
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

  /** returns true if it was the last observer for the given uriOrType */
  private removeObserver(observer: Observer, uriOrType: string): boolean {
    const observers = this.observers.get(uriOrType);
    if (observers) {
      observers.splice(observers.indexOf(observer), 1);
      if (observers.length == 0) {
        this.observers.delete(uriOrType);
        return true;
      }
    }
  }

  private notifyObservers(event) {
    if (event.data.paramUri) {
      const observers = this.getObservers(event.data.paramUri)
        .concat(this.getObservers(event.data.paramType));
      observers.forEach(o => (<ValueObserver>o).observedValueChanged(event.data.paramUri, event.data.paramType, event.data.value));
    } else if (event.data.dymoUri) {
      const observers = this.getObservers(event.data.dymoUri);
      observers.forEach(o => (<PartsObserver>o).observedPartsChanged(event.data.dymoUri));
    }
  }

  private getObservers(uriOrType: string): Observer[] {
    const observers = this.observers.get(uriOrType);
    return observers ? observers : [];
  }

}