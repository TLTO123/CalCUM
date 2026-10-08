// pdfjs-dist no declara tipos para el subpath legacy (solo para la raíz, cuyo
// build no funciona en Node). Declaración local con la misma API pública.
declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export * from 'pdfjs-dist';
}
