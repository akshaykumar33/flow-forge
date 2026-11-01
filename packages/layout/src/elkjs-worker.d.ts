/** elkjs ships no typings for its in-process worker; this is its whole public shape. */
declare module 'elkjs/lib/elk-worker.min.js' {
  const elkWorker: { Worker: new () => unknown; default: new () => unknown };
  export default elkWorker;
}
