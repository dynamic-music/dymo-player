/*declare module "worker-loader!*" {
  class WebpackWorker extends Worker {
    constructor();
  }

  export default WebpackWorker;
}*/

declare module "worker-loader!*" {
  const content: new () => any;
  export = content;
}