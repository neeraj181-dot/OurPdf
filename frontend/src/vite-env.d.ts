/// <reference types="vite/client" />

declare module "*?url" {
  const src: string;
  export default src;
}

declare module "imagetracerjs" {
  const ImageTracer: any;
  export default ImageTracer;
}

declare module "mammoth" {
  const mammoth: any;
  export default mammoth;
}
