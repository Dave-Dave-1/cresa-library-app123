import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const booksDirectory = resolve(process.env.BOOKS_DIR ?? join(projectRoot, 'public', 'books'))

function normalizeText(items) {
  return items
    .map(item => item.str.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function convertPdf(pdfPath) {
  const pdfBytes = new Uint8Array(await readFile(pdfPath))
  const pdf = await getDocument({ data: pdfBytes, useWorkerFetch: false, isEvalSupported: false }).promise
  const paragraphs = []
  let pagesWithText = 0

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = normalizeText(content.items)
    if (text) pagesWithText += 1
    paragraphs.push(new Paragraph({
      pageBreakBefore: pageNumber > 1,
      children: [new TextRun(text || '[No extractable text on this page.]')],
    }))
  }

  const document = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  })
  const outputPath = join(booksDirectory, `${basename(pdfPath, extname(pdfPath))}.docx`)
  await writeFile(outputPath, await Packer.toBuffer(document))
  return { outputPath, pages: pdf.numPages, pagesWithText }
}

const filenames = (await readdir(booksDirectory))
  .filter(filename => extname(filename).toLowerCase() === '.pdf')
  .sort()

if (!filenames.length) throw new Error(`No PDF files found in ${booksDirectory}`)

for (const filename of filenames) {
  const result = await convertPdf(join(booksDirectory, filename))
  const warning = result.pagesWithText < result.pages ? `; ${result.pages - result.pagesWithText} page(s) had no extractable text` : ''
  console.log(`${filename} -> ${basename(result.outputPath)} (${result.pages} page(s)${warning})`)
}