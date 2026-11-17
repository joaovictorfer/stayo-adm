import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import backgroundUrl from '@/assets/letters/contract-letterhead.pdf?url';
import regularAsset from '@/assets/letters/regular.ttf.asset.json';
import boldAsset from '@/assets/letters/bold.ttf.asset.json';
import { letterLayout, letterSignatureSpace, letterVehicleSpace, type Para, type AuthorizationLetterFields } from '../authorization-letter';
import { letterIcons, letterPalette, type LetterIcon } from '../authorization-letter-icons';

export async function generateAuthorizationLetterPdf(fields: AuthorizationLetterFields): Promise<Uint8Array> {
  const fetchBytes = async (url: string) => { const response = await fetch(url); if (!response.ok) throw new Error('Não foi possível carregar o modelo da carta.'); return new Uint8Array(await response.arrayBuffer()); };
  const [background, regular, bold] = await Promise.all([fetchBytes(backgroundUrl), fetchBytes(regularAsset.url), fetchBytes(boldAsset.url)]);
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const [normalFont, boldFont] = await Promise.all([pdf.embedFont(regular), pdf.embedFont(bold)]);
  const source = await PDFDocument.load(background);
  const [paper] = await pdf.embedPages([source.getPage(0)]);
  if (!paper) throw new Error('Papel timbrado indisponível.');
  const icons = new Map<LetterIcon, Awaited<ReturnType<typeof pdf.embedPng>>>();
  await Promise.all(Object.entries(letterIcons).map(async ([key, value]) => icons.set(key as LetterIcon, await pdf.embedPng(Uint8Array.from(atob(value), c => c.charCodeAt(0))))));
  const color = (hex: string) => rgb(parseInt(hex.slice(0,2),16)/255, parseInt(hex.slice(2,4),16)/255, parseInt(hex.slice(4,6),16)/255);
  const width = paper.width, height = paper.height, left = 85.05, contentWidth = width - left * 2;
  let page = pdf.addPage([width, height]), y = height - 135;
  const backgroundPage = () => page.drawPage(paper, { x: 0, y: 0, width, height }); backgroundPage();
  const size = 9.5, lineHeight = 11.4;
  type Word = { text: string; font: PDFFont };
  const wrap = (p: Para, available: number): Word[][] => {
    const fullText = p.runs.map(r => r.text).join('');
    const words = Array.from(fullText.matchAll(/\S+/g), match => {
      let offset = 0;
      const run = p.runs.find(item => { offset += item.text.length; return offset > (match.index ?? 0); });
      return { text: match[0], font: run?.bold ? boldFont : normalFont };
    });
    const lines: Word[][] = []; let row: Word[] = [], used = 0;
    for (const word of words) {
      // Split exceptionally long tokens rather than draw outside a table cell.
      const chunks: string[] = []; let chunk = '';
      for (const char of word.text) { if (chunk && word.font.widthOfTextAtSize(chunk + char, size) > available) { chunks.push(chunk); chunk = ''; } chunk += char; }
      if (chunk) chunks.push(chunk);
      for (const text of chunks) {
        const w = word.font.widthOfTextAtSize(text,size), gap = row.length ? normalFont.widthOfTextAtSize(' ',size) : 0;
        if (row.length && used + gap + w > available) { lines.push(row); row = []; used = 0; }
        row.push({text,font:word.font}); used += (row.length > 1 ? normalFont.widthOfTextAtSize(' ',size) : 0) + w;
      }
    }
    if(row.length) lines.push(row); return lines;
  };
  const paragraphHeight = (p: Para, w: number) => Math.max(p.icon ? 15 : 0, wrap(p, w - (p.icon ? 22 : 0)).length * lineHeight) + (p.icon ? 6 : Math.min(p.after ?? 100,80)/20);
  const ensure = (h: number) => { if (y - h < 65) { page = pdf.addPage([width,height]); backgroundPage(); y = height - 135; } };
  const drawPara = (p: Para,x: number,top: number,w: number) => {
    const indent = p.icon ? 22 : 0, lines = wrap(p,w-indent);
    if(p.icon) { const icon = icons.get(p.icon); if(icon) page.drawImage(icon,{x,y:top-6,width:15,height:15}); }
    lines.forEach((row,i) => {
      const gap = normalFont.widthOfTextAtSize(' ',size), rw = row.reduce((sum,a)=>sum+a.font.widthOfTextAtSize(a.text,size),0) + (row.length-1)*gap;
      let xx = p.align === 'center' ? x+(w-rw)/2 : p.align === 'right' ? x+w-rw : x+indent;
      row.forEach(word=> { page.drawText(word.text,{x:xx,y:top-i*lineHeight,size,font:word.font,color:color(p.icon?letterPalette.ink:letterPalette.text)}); xx += word.font.widthOfTextAtSize(word.text,size)+gap; });
    });
    if(p.divider) page.drawLine({start:{x:x+indent,y:top-7},end:{x:x+w,y:top-7},thickness:.5,color:color(letterPalette.rule)});
  };
  const blocks = letterLayout(fields);
  for (let index=0;index<blocks.length;index++) {
    const block = blocks[index]; if(!block) continue;
    if(block.kind==='paragraph') {
      const h = paragraphHeight(block.paragraph,contentWidth);
      const next=blocks[index+1];
      const signature = block.paragraph.runs[0]?.text.startsWith('___');
      const signatureHeight = signature ? blocks.slice(index,index+3).reduce((sum,b)=>sum+(b.kind==='paragraph'?paragraphHeight(b.paragraph,contentWidth):0),0) : 0;
      ensure(signatureHeight || h + (block.paragraph.icon && next?.kind==='paragraph' ? paragraphHeight(next.paragraph,contentWidth) : block.paragraph.icon ? 40 : 0));
      drawPara(block.paragraph,left,y,contentWidth); y-=h;
    } else if(block.kind==='parties') {
      const cw=contentWidth/2, pad=10;
      const h=Math.max(...block.columns.map(col=>col.reduce((sum,p)=>sum+paragraphHeight({...p,divider:false},cw-pad*2),0)))+pad*2;
      ensure(h); page.drawRectangle({x:left,y:y-h+10,width:contentWidth,height:h,color:color(letterPalette.panel)});
      page.drawLine({start:{x:left+cw,y:y},end:{x:left+cw,y:y-h+20},thickness:.5,color:color(letterPalette.rule)});
      block.columns.forEach((col,i)=> { let yy=y; col.forEach(p=>{drawPara({...p,divider:false},left+i*cw+pad,yy,cw-pad*2); yy-=paragraphHeight({...p,divider:false},cw-pad*2);}); }); y-=h+5;
    } else if(block.kind==='signatures') {
      const cellWidth=contentWidth/block.columns.length, pad=8;
      const columns=block.columns.map(col=>col.slice(1));
      const h=Math.max(...columns.map(col=>col.reduce((sum,p)=>sum+paragraphHeight(p,cellWidth-pad*2),0)))+18;
      ensure(h + letterSignatureSpace);
      y -= letterSignatureSpace;
      columns.forEach((col,i)=>{
        const x=left+i*cellWidth+pad;
        page.drawLine({start:{x,y:y-4},end:{x:x+cellWidth-pad*2,y:y-4},thickness:.5,color:color(letterPalette.text)});
        let yy=y-18;
        col.forEach(p=>{drawPara(p,x,yy,cellWidth-pad*2);yy-=paragraphHeight(p,cellWidth-pad*2);});
      });y-=h+10;
    } else if(block.kind==='table') {
      const widths=[contentWidth*.56,contentWidth*.44], pad=7;
      const drawRow=(row:string[],header:boolean)=>{
        const cells=row.map(text=>({runs:[{text,bold:header}],align:'left' as const,after:0}));
        const h=Math.max(...cells.map((p,i)=>wrap(p,(widths[i]??0)-pad*2).length*lineHeight))+10;
        ensure(h); let x=left;
        cells.forEach((p,i)=>{
          const w=widths[i]??0;
          const lines=wrap(p,w-pad*2).length;
          const textHeight=normalFont.heightAtSize(size,{descender:false})+Math.max(0,lines-1)*lineHeight;
          const baseline=y+8-(h-textHeight)/2-normalFont.heightAtSize(size,{descender:false});
          page.drawRectangle({x,y:y-h+8,width:w,height:h,color:color(header?letterPalette.panel:letterPalette.paper),borderColor:color(letterPalette.rule),borderWidth:.4});
          drawPara(p,x+pad,baseline,w-pad*2);x+=w;
        }); y-=h;
      };
      block.rows.forEach((row,i)=>{ if(y-35<65 && i>0){ensure(50);const header=block.rows[0];if(header)drawRow(header,true);} drawRow(row,i===0); }); y-=10;
    } else {
      let x=left; ensure(30 + letterVehicleSpace); y -= letterVehicleSpace;
      for(const plate of block.plates){const w=boldFont.widthOfTextAtSize(plate,size)+20;if(x+w>left+contentWidth){x=left;y-=27;ensure(30);}page.drawRectangle({x,y:y-9,width:w,height:23,color:color(letterPalette.panel)});page.drawText(plate,{x:x+10,y:y-1,size,font:boldFont,color:color(letterPalette.text)});x+=w+8;}y-=33;
    }
  }
  pdf.setTitle(`Carta de autorização à portaria – ${fields.condominium} ${fields.unit}`);
  pdf.setAuthor('STAYO Gramado'); return pdf.save();
}
