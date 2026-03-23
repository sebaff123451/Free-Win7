/* ============================================================
   js/script.js – Windows 7 Professional v2
   Correcciones: selección múltiple + clic derecho sin deseleccionar,
   arrastre real (drag while holding click), sistema de slots en escritorio,
   arrastrar a ventana explorador para copiar, menú contextual en explorador,
   todas las apps nuevas, panel de control funcional, configuración, etc.
   ============================================================ */

/* ============================================================
   1. ESTADO GLOBAL
   ============================================================ */
let fs = {
  id:'root',type:'folder',name:'root',children:[
    {id:'desktop-folder',type:'folder',name:'Escritorio',children:[
      {id:'docs-folder',type:'folder',name:'Documentos',children:[
        {id:'readme-file',type:'file',name:'Leame.txt',ext:'txt',
         content:'¡Bienvenido a Windows 7 Web!\n\nSistema operativo simulado en HTML5, CSS3 y JavaScript puro.\n\nCaracterísticas:\n- Escritorio con slots organizados\n- Explorador de archivos con arrastrar y soltar\n- Bloc de notas, Paint, Calculadora\n- Símbolo del sistema con comandos reales\n- Solitario y Buscaminas\n- Panel de control y Configuración funcionales\n',
         hidden:false,dateModified:new Date().toISOString(),size:300}
      ]},
      {id:'music-folder',type:'folder',name:'Música',children:[],hidden:false,dateModified:new Date().toISOString(),size:0},
      {id:'pics-folder',type:'folder',name:'Imágenes',children:[],hidden:false,dateModified:new Date().toISOString(),size:0},
      {id:'scratch-folder',type:'folder',name:'Proyectos Scratch',children:[],hidden:false,dateModified:new Date().toISOString(),size:0}
    ]}
  ]
};

let recycleBin  = [];
let trayState   = {wifiLevel:3, batteryLevel:4};
let maxZ        = 1000;
let ctxTargetId = null;
let ctxMultiIds = [];
let selStart    = null;
let iconSize    = 'medium';
let calDate     = new Date();
let tooltipTimer= null;
let clipboard   = {action:null, ids:[]};   /* cut / copy */
let showHidden  = false;
let showExtensions = true;
let showNavPanel   = true;
let activeDrag  = null;   /* {ids, sourceParentId} para arrastre entre ventanas */

/* Configuración del sistema (persiste) */
let sysConfig = {
  wallpaper:'url("img/wallpaper.jpg") center/cover no-repeat, linear-gradient(135deg,#1a6ea8,#0c4a8a 40%,#072d5e)',
  wallpaperColor:'#1a6ea8',
  taskbarColor:'rgba(12,28,60,.85)',
  taskbarRgb:true,
  titlebarColor:'#1a6ea8',
  titlebarRgb:false,
  username:'Usuario',
  fontScale:1,
  theme:'aero',    /* aero / classic / highcontrast */
  language:'es',
  timezone:'America/Montevideo',
  screenRes:'1920x1080',
  sound:true,
  soundVol:80,
  mouseSpeed:5,
  keyboardRepeat:3,
  uac:true,
  autoUpdate:true,
  defragSchedule:'semanal',
};

/* Slots del escritorio: columna(s) de iconos */
/* Se calculan dinámicamente por JS según el tamaño */

/* ============================================================
   2. PERSISTENCIA
   ============================================================ */
function saveState(){
  try{
    localStorage.setItem('win7-web-v2',JSON.stringify({fs,recycleBin,trayState,iconSize,showHidden,showExtensions,showNavPanel,sysConfig}));
  }catch(e){}
}
function loadState(){
  try{
    const raw=localStorage.getItem('win7-web-v2');
    if(!raw)return;
    const s=JSON.parse(raw);
    if(s.fs)           fs=s.fs;
    if(s.recycleBin)   recycleBin=s.recycleBin;
    if(s.trayState)    trayState=s.trayState;
    if(s.iconSize)     iconSize=s.iconSize;
    if(s.showHidden!==undefined)    showHidden=s.showHidden;
    if(s.showExtensions!==undefined) showExtensions=s.showExtensions;
    if(s.showNavPanel!==undefined)   showNavPanel=s.showNavPanel;
    if(s.sysConfig)    Object.assign(sysConfig,s.sysConfig);
  }catch(e){}
}

/* ============================================================
   3. UTILIDADES FS
   ============================================================ */
function uid(){return 'id_'+Math.random().toString(36).slice(2,10);}

function findItemById(id,node){
  node=node||fs;
  if(node.id===id)return node;
  if(node.children){for(const c of node.children){const f=findItemById(id,c);if(f)return f;}}
  return null;
}
function findParent(id,node){
  node=node||fs;
  if(!node.children)return null;
  for(const c of node.children){
    if(c.id===id)return node;
    const f=findParent(id,c);if(f)return f;
  }
  return null;
}
function getUniqueName(base,siblings){
  const ex=siblings.map(s=>s.name);
  if(!ex.includes(base))return base;
  let i=1;while(ex.includes(`${base} (${i})`))i++;
  return `${base} (${i})`;
}
function getDisplayName(item){
  if(showExtensions||item.type!=='file')return item.name;
  const dot=item.name.lastIndexOf('.');
  return dot>0?item.name.slice(0,dot):item.name;
}
function formatSize(bytes){
  if(bytes<1024)return bytes+' B';
  if(bytes<1048576)return (bytes/1024).toFixed(1)+' KB';
  return (bytes/1048576).toFixed(1)+' MB';
}
function now(){return new Date().toISOString();}

/* ============================================================
   4. MENÚS Y TOOLTIPS
   ============================================================ */
function closeAllMenus(){
  document.querySelectorAll('.context-menu').forEach(m=>m.classList.add('hidden'));
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('calendar').classList.add('hidden');
  document.getElementById('all-programs-panel').classList.add('hidden');
  hideTooltip();
}
function showContextMenu(id,x,y){
  closeAllMenus();
  const m=document.getElementById(id);if(!m)return;
  m.classList.remove('hidden');
  const mw=m.offsetWidth||180,mh=m.offsetHeight||100;
  m.style.left=Math.min(x,window.innerWidth -mw-4)+'px';
  m.style.top =Math.min(y,window.innerHeight-mh-4)+'px';
}
function showTooltip(text,x,y){
  const t=document.getElementById('tooltip');
  t.textContent=text;t.style.left=x+'px';t.style.top=(y-34)+'px';t.classList.remove('hidden');
}
function hideTooltip(){clearTimeout(tooltipTimer);document.getElementById('tooltip').classList.add('hidden');}

/* ============================================================
   5. SISTEMA DE SLOTS EN EL ESCRITORIO
   ============================================================ */
/* Retorna {x,y} del slot N */
const SLOT_PADDING_TOP  = 14;
const SLOT_PADDING_LEFT = 14;
const SLOT_GAP          = 8;
const ICON_HEIGHTS = {xlarge:92+20+8, large:76+18+8, medium:68+16+8, small:52+14+8};
const ICON_WIDTHS  = {xlarge:92, large:84, medium:76, small:64};

function getSlotPos(idx){
  const dh=window.innerHeight-40-SLOT_PADDING_TOP;
  const ih=ICON_HEIGHTS[iconSize]||84;
  const iw=ICON_WIDTHS[iconSize]||76;
  const perCol=Math.max(1,Math.floor(dh/(ih+SLOT_GAP)));
  const col=Math.floor(idx/perCol);
  const row=idx%perCol;
  return {x:SLOT_PADDING_LEFT+col*(iw+SLOT_GAP), y:SLOT_PADDING_TOP+row*(ih+SLOT_GAP)};
}

/* Mapa: itemId -> slotIndex (para iconos dinámicos del FS) */
let iconSlots={};   /* {id:slotIdx} */

function assignSlots(){
  /* Iconos fijos: columna 0, slots 0-3 */
  const fixedIds=['mycomputer','network','controlpanel','recyclebin'];
  fixedIds.forEach((id,i)=>{
    const el=document.getElementById('icon-'+id);
    if(!el)return;
    const pos=getSlotPos(i);
    el.style.left=pos.x+'px';
    el.style.top =pos.y+'px';
  });

  /* Iconos dinámicos: empiezan a partir del slot 4 */
  const folder=findItemById('desktop-folder');
  if(!folder||!folder.children)return;
  const visible=folder.children.filter(c=>showHidden||!c.hidden);
  const nextSlot=4;
  visible.forEach((item,i)=>{
    if(!(item.id in iconSlots))iconSlots[item.id]=nextSlot+i;
  });
  /* Si se ha borrado alguno, reasignar compacto */
  const ids=visible.map(c=>c.id);
  const sorted=Object.entries(iconSlots).filter(([id])=>ids.includes(id)).sort((a,b)=>a[1]-b[1]);
  sorted.forEach(([id],i)=>{iconSlots[id]=nextSlot+i;});
  /* Asignar los que no tienen slot */
  ids.forEach(id=>{
    if(!(id in iconSlots)){
      const usedSlots=Object.values(iconSlots);
      let s=nextSlot;while(usedSlots.includes(s))s++;
      iconSlots[id]=s;
    }
  });
}

/* ============================================================
   6. RENDER ESCRITORIO
   ============================================================ */
function renderDesktop(){
  assignSlots();
  const container=document.getElementById('dynamic-icons');
  container.innerHTML='';
  const folder=findItemById('desktop-folder');
  if(!folder||!folder.children)return;
  folder.children.forEach(item=>{
    if(!showHidden&&item.hidden)return;
    const el=createDesktopIcon(item);
    container.appendChild(el);
  });
  updateRecycleBinIcon();
  applyIconSize();
  applySystemConfig();
}

function createDesktopIcon(item){
  const el=document.createElement('div');
  el.className='icon icon-'+iconSize+(item.hidden?' hidden-file':'');
  el.dataset.id=item.id;
  const pos=getSlotPos(iconSlots[item.id]||4);
  el.style.left=pos.x+'px';
  el.style.top =pos.y+'px';
  if(item.type==='shortcut')el.classList.add('shortcut');

  let imgSrc=item.type==='folder'?'img/folder.png':'img/notepad.png';
  let faIcon=item.type==='folder'?'fa-folder':'fa-file-lines';
  let faColor=item.type==='folder'?'#f0b429':'#0c64b5';

  el.innerHTML=`
    <img src="${imgSrc}" width="48" height="48" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
    <i class="icon-fallback fa-solid ${faIcon}" style="display:none;color:${faColor}"></i>
    <span>${getDisplayName(item)}</span>`;

  /* Doble click */
  el.addEventListener('dblclick',e=>{e.stopPropagation();openItem(item.id);});

  /* Click derecho */
  el.addEventListener('contextmenu',e=>{
    e.preventDefault();e.stopPropagation();
    const sel=getSelectedIds();
    if(sel.length>1&&sel.includes(item.id)){
      /* Menú multi */
      ctxMultiIds=sel;
      document.getElementById('multi-count').textContent=sel.length;
      showContextMenu('multi-menu',e.clientX,e.clientY);
    } else {
      if(!e.ctrlKey&&!el.classList.contains('selected'))clearSelection();
      el.classList.add('selected');
      ctxTargetId=item.id;ctxMultiIds=[];
      showContextMenu('file-menu',e.clientX,e.clientY);
    }
  });

  /* Click simple */
  el.addEventListener('mousedown',e=>{
    e.stopPropagation();
    if(!e.ctrlKey&&!el.classList.contains('selected'))clearSelection();
    el.classList.add('selected');
  });

  /* Arrastre al slot más cercano (drag while holding) */
  makeIconDraggable(el,item.id);

  return el;
}

function openItem(id){
  const item=findItemById(id);if(!item)return;
  if(item.type==='folder')openExplorer(id);
  else if(item.type==='file'){
    if(item.ext==='scratch')openScratch(id);else openNotepad(id);
  }
  else if(item.type==='shortcut'){
    if(item.appAction){runProgramAction(item.appAction);return;}
    const t=findItemById(item.targetId);if(t)openItem(t.id);
  }
}

function makeIconDraggable(el,itemId){
  let startX,startY,startL,startT,moved=false;
  el.addEventListener('mousedown',e=>{
    if(e.button!==0)return;
    startX=e.clientX;startY=e.clientY;
    startL=parseInt(el.style.left)||0;startT=parseInt(el.style.top)||0;
    moved=false;
    el.style.zIndex=++maxZ;

    const onMove=e=>{
      const dx=e.clientX-startX,dy=e.clientY-startY;
      if(Math.abs(dx)>4||Math.abs(dy)>4){
        moved=true;
        el.style.left=Math.max(0,startL+dx)+'px';
        el.style.top =Math.max(0,startT+dy)+'px';
      }
    };
    const onUp=e=>{
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
      if(!moved)return;
      /* Detectar si soltó sobre un explorador abierto */
      const drop=findDropTarget(e.clientX,e.clientY);
      if(drop){
        copyItemsToFolder(getSelectedIds().length>1?getSelectedIds():[itemId],drop.folderId);
        /* Volver al slot original */
        const pos=getSlotPos(iconSlots[itemId]||4);
        el.style.left=pos.x+'px';el.style.top=pos.y+'px';
      } else {
        /* Snap al slot más cercano */
        const slot=posToSlot(parseInt(el.style.left),parseInt(el.style.top));
        iconSlots[itemId]=slot;
        const pos=getSlotPos(slot);
        el.style.left=pos.x+'px';el.style.top=pos.y+'px';
        saveState();
      }
    };
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });
}

/* Convierte coordenadas pixel a slot más cercano (sin pisar fijos 0-3) */
function posToSlot(px,py){
  const dh=window.innerHeight-40-SLOT_PADDING_TOP;
  const ih=ICON_HEIGHTS[iconSize]||84;
  const iw=ICON_WIDTHS[iconSize]||76;
  const perCol=Math.max(1,Math.floor(dh/(ih+SLOT_GAP)));
  const col=Math.round((px-SLOT_PADDING_LEFT)/(iw+SLOT_GAP));
  const row=Math.round((py-SLOT_PADDING_TOP )/(ih+SLOT_GAP));
  const slot=Math.max(0,col)*perCol+Math.max(0,Math.min(row,perCol-1));
  return Math.max(4,slot); /* nunca pisar fijos */
}

/* Busca si hay una ventana de explorador bajo las coords */
function findDropTarget(cx,cy){
  const wins=document.querySelectorAll('.window');
  for(const w of [...wins].reverse()){
    const r=w.getBoundingClientRect();
    if(cx>=r.left&&cx<=r.right&&cy>=r.top&&cy<=r.bottom){
      const fid=w.dataset.explorerfolder;
      if(fid)return{folderId:fid};
    }
  }
  return null;
}

/* Copia items a otra carpeta */
function copyItemsToFolder(ids,destFolderId){
  const dest=findItemById(destFolderId);
  if(!dest||!dest.children)return;
  ids.forEach(id=>{
    const item=findItemById(id);if(!item)return;
    const clone=JSON.parse(JSON.stringify(item));
    clone.id=uid();
    clone.name=getUniqueName(item.name,dest.children);
    dest.children.push(clone);
  });
  saveState();
  /* Refrescar cualquier explorador abierto de esa carpeta */
  document.querySelectorAll(`.window[data-explorerfolder="${destFolderId}"]`).forEach(w=>{
    w._refreshExplorer&&w._refreshExplorer();
  });
}

function applyIconSize(){
  document.querySelectorAll('.icon').forEach(el=>{
    el.classList.remove('icon-xlarge','icon-large','icon-medium','icon-small');
    el.classList.add('icon-'+iconSize);
  });
}
function clearSelection(){
  document.querySelectorAll('.icon.selected').forEach(el=>el.classList.remove('selected'));
}
function getSelectedIds(){
  return [...document.querySelectorAll('.icon.selected')].map(el=>el.dataset.id).filter(Boolean);
}
function updateRecycleBinIcon(){
  const img=document.getElementById('recyclebin-img');
  if(img)img.src=recycleBin.length>0?'img/recycle-bin-full.png':'img/recycle-bin.png';
}

/* ============================================================
   7. GESTOR DE VENTANAS
   ============================================================ */
function createWindow(opts){
  const {title='Ventana',icon='fa-solid fa-window-maximize',width=600,height=400,
    x=80+Math.random()*80,y=50+Math.random()*60,contentFn,winId=uid(),menuItems=null}=opts;
  const container=document.getElementById('windows-container');
  const win=document.createElement('div');
  win.className='window window-opening';
  win.dataset.winId=winId;
  win.style.cssText=`width:${width}px;height:${height}px;left:${x}px;top:${y}px;z-index:${++maxZ}`;

  win.innerHTML=`
    <div class="title-bar">
      <i class="${icon} title-bar-icon"></i>
      <span class="title-bar-text">${title}</span>
      <div class="title-bar-buttons">
        <button class="win-btn min-btn" title="Minimizar"><i class="fa-solid fa-minus"></i></button>
        <button class="win-btn max-btn" title="Maximizar"><i class="fa-solid fa-square"></i></button>
        <button class="win-btn close-btn" title="Cerrar"><i class="fa-solid fa-xmark"></i></button>
      </div>
    </div>
    ${menuItems?'<div class="menu-bar">'+menuItems.map(m=>`<span class="menu-bar-item" data-action="${m.action}">${m.label}</span>`).join('')+'</div>':''}
    <div class="window-content"></div>
    <div class="resize-handle n"></div><div class="resize-handle s"></div>
    <div class="resize-handle e"></div><div class="resize-handle w"></div>
    <div class="resize-handle nw"></div><div class="resize-handle ne"></div>
    <div class="resize-handle sw"></div><div class="resize-handle se"></div>`;

  container.appendChild(win);
  if(contentFn)contentFn(win.querySelector('.window-content'));
  win.addEventListener('animationend',()=>win.classList.remove('window-opening'),{once:true});
  win.addEventListener('mousedown',()=>bringToFront(win));

  /* Botones ventana */
  let minimized=false;
  win.querySelector('.close-btn').addEventListener('click',e=>{e.stopPropagation();win.remove();removeTaskbarBtn(winId);});
  win.querySelector('.min-btn').addEventListener('click',e=>{
    e.stopPropagation();minimized=!minimized;
    win.classList.toggle('minimized',minimized);
    const b=document.querySelector(`.taskbar-win-btn[data-win-id="${winId}"]`);
    if(b)b.classList.toggle('active',!minimized);
  });
  let maximized=false,savedGeom=null;
  win.querySelector('.max-btn').addEventListener('click',e=>{
    e.stopPropagation();
    if(!maximized){
      savedGeom={left:win.style.left,top:win.style.top,width:win.style.width,height:win.style.height};
      win.style.cssText+=';left:0;top:0;width:100vw;height:calc(100vh - 40px)';
      maximized=true;
    } else {
      Object.assign(win.style,savedGeom);maximized=false;
    }
  });

  makeDraggable(win,win.querySelector('.title-bar'));
  win.querySelectorAll('.resize-handle').forEach(h=>makeResizable(win,h));
  addTaskbarBtn(winId,title,icon,()=>{
    minimized=!minimized;
    win.classList.toggle('minimized',minimized);
    const b=document.querySelector(`.taskbar-win-btn[data-win-id="${winId}"]`);
    if(b)b.classList.toggle('active',!minimized);
    if(!minimized)bringToFront(win);
  });
  bringToFront(win);
  return win;
}

function bringToFront(win){
  win.style.zIndex=++maxZ;
  document.querySelectorAll('.taskbar-win-btn').forEach(b=>b.classList.remove('active'));
  const b=document.querySelector(`.taskbar-win-btn[data-win-id="${win.dataset.winId}"]`);
  if(b)b.classList.add('active');
}
function addTaskbarBtn(winId,title,icon,toggleFn){
  const bar=document.getElementById('taskbar-windows');
  const btn=document.createElement('button');
  btn.className='taskbar-win-btn active';btn.dataset.winId=winId;
  btn.innerHTML=`<i class="${icon}"></i> <span>${title.slice(0,20)}</span>`;
  btn.title=title;btn.addEventListener('click',toggleFn);
  bar.appendChild(btn);
}
function removeTaskbarBtn(winId){
  const b=document.querySelector(`.taskbar-win-btn[data-win-id="${winId}"]`);if(b)b.remove();
}
function makeDraggable(win,handle){
  let sx,sy,sl,st;
  handle.addEventListener('mousedown',e=>{
    if(e.button!==0||e.target.closest('.title-bar-buttons'))return;
    e.preventDefault();
    sx=e.clientX;sy=e.clientY;sl=parseInt(win.style.left)||0;st=parseInt(win.style.top)||0;
    const mv=e=>{win.style.left=Math.max(0,sl+(e.clientX-sx))+'px';win.style.top=Math.max(0,st+(e.clientY-sy))+'px';};
    const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
}
function makeResizable(win,handle){
  const dir=[...handle.classList].find(c=>c!=='resize-handle');
  handle.addEventListener('mousedown',e=>{
    if(e.button!==0)return;e.preventDefault();e.stopPropagation();
    const sx=e.clientX,sy=e.clientY,sw=win.offsetWidth,sh=win.offsetHeight,sl=parseInt(win.style.left)||0,st=parseInt(win.style.top)||0;
    const mv=e=>{
      const dx=e.clientX-sx,dy=e.clientY-sy;
      if(dir.includes('e'))win.style.width =Math.max(240,sw+dx)+'px';
      if(dir.includes('s'))win.style.height=Math.max(160,sh+dy)+'px';
      if(dir.includes('w')){const nw=Math.max(240,sw-dx);win.style.width=nw+'px';win.style.left=(sl+sw-nw)+'px';}
      if(dir.includes('n')){const nh=Math.max(160,sh-dy);win.style.height=nh+'px';win.style.top=(st+sh-nh)+'px';}
    };
    const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
}

/* ============================================================
   8. EXPLORADOR DE ARCHIVOS
   ============================================================ */
function openExplorer(folderId){
  folderId=folderId||'desktop-folder';
  const folder=findItemById(folderId)||findItemById('desktop-folder');
  const winId=uid();
  const win=createWindow({title:folder.name+' – Explorador de Windows',icon:'fa-solid fa-folder-open',width:720,height:440,winId});
  win.dataset.explorerfolder=folderId;

  let currentFolderId=folderId;
  let expViewMode='medium';  /* medium|small|large|list|details */
  let expShowHidden=showHidden;
  let expShowExt=showExtensions;
  let expShowNav=showNavPanel;
  let expSortBy='name';      /* name|type|date|size */
  let histStack=[folderId],histIdx=0;

  const content=win.querySelector('.window-content');
  content.style.cssText='display:flex;flex-direction:column;height:100%;';

  /* Barra dirección */
  const addrBar=document.createElement('div');
  addrBar.className='address-bar';
  addrBar.innerHTML=`
    <button class="win-btn exp-back" style="height:24px;width:24px" title="Atrás"><i class="fa-solid fa-chevron-left"></i></button>
    <button class="win-btn exp-fwd"  style="height:24px;width:24px" title="Adelante"><i class="fa-solid fa-chevron-right"></i></button>
    <button class="win-btn exp-up"   style="height:24px;width:24px" title="Subir"><i class="fa-solid fa-arrow-up"></i></button>
    <input type="text" class="exp-addr" value="${folder.name}" readonly>
    <button class="win-btn exp-refresh" style="height:24px;width:24px" title="Actualizar"><i class="fa-solid fa-rotate-right"></i></button>`;
  content.appendChild(addrBar);

  /* Cuerpo */
  const body=document.createElement('div');
  body.className='explorer-body';body.style.flex='1';body.style.overflow='hidden';
  const sidebar=document.createElement('div');sidebar.className='explorer-sidebar';
  if(!expShowNav)sidebar.classList.add('hidden-panel');
  const mainPanel=document.createElement('div');mainPanel.className='explorer-main';
  const statusBar=document.createElement('div');statusBar.className='explorer-status';
  body.appendChild(sidebar);body.appendChild(mainPanel);
  content.appendChild(body);content.appendChild(statusBar);

  /* Sidebar */
  function buildSidebar(){
    sidebar.innerHTML='';
    const ul=document.createElement('ul');
    const items=[
      {id:'mycomputer-virt',name:'Mi PC',icon:'fa-solid fa-computer'},
      {id:'desktop-folder',name:'Escritorio',icon:'fa-solid fa-desktop'},
      {id:'docs-folder',name:'Documentos',icon:'fa-solid fa-folder'},
      {id:'music-folder',name:'Música',icon:'fa-solid fa-music'},
      {id:'pics-folder',name:'Imágenes',icon:'fa-solid fa-image'},
      {id:'recyclebin',name:'Papelera',icon:'fa-solid fa-trash-can'},
    ];
    items.forEach(it=>{
      const li=document.createElement('li');
      li.dataset.id=it.id;
      li.innerHTML=`<i class="${it.icon}"></i> ${it.name}`;
      if(it.id===currentFolderId)li.classList.add('selected');
      li.addEventListener('click',()=>navigate(it.id));
      ul.appendChild(li);
    });
    sidebar.appendChild(ul);
  }

  /* Render de carpeta */
  function renderFolder(){
    mainPanel.innerHTML='';
    const node=findItemById(currentFolderId);
    if(!node||!node.children){
      mainPanel.innerHTML='<p style="color:#999;padding:20px;font-size:.85rem;">No se puede mostrar este contenido.</p>';
      return;
    }
    let items=[...node.children].filter(c=>expShowHidden||!c.hidden);
    /* Ordenar */
    items.sort((a,b)=>{
      if(expSortBy==='name')return a.name.localeCompare(b.name);
      if(expSortBy==='type')return a.type.localeCompare(b.type)||a.name.localeCompare(b.name);
      if(expSortBy==='date')return (b.dateModified||'').localeCompare(a.dateModified||'');
      if(expSortBy==='size')return (b.size||0)-(a.size||0);
      return 0;
    });
    if(items.length===0){
      mainPanel.innerHTML='<p style="color:#999;padding:20px;font-size:.85rem;">Esta carpeta está vacía.</p>';
      statusBar.textContent='0 objetos';return;
    }
    if(expViewMode==='details'){
      const tbl=document.createElement('table');tbl.className='explorer-details';
      tbl.innerHTML=`<thead><tr>
        <th data-col="name">Nombre</th><th data-col="type">Tipo</th>
        <th data-col="date">Fecha</th><th data-col="size">Tamaño</th>
      </tr></thead><tbody></tbody>`;
      tbl.querySelectorAll('th').forEach(th=>th.addEventListener('click',()=>{expSortBy=th.dataset.col;renderFolder();}));
      const tbody=tbl.querySelector('tbody');
      items.forEach(item=>{
        const tr=document.createElement('tr');
        tr.dataset.id=item.id;
        const dtype=item.type==='folder'?'Carpeta de archivos':'Archivo de texto';
        const ddate=item.dateModified?item.dateModified.slice(0,10):'—';
        const dsize=item.type==='file'?formatSize(item.content?item.content.length:0):'—';
        const dicon=item.type==='folder'?'fa-folder':'fa-file-lines';
        const dcolor=item.type==='folder'?'color:#f0b429':'color:#0c64b5';
        tr.innerHTML=`<td class="file-icon"><i class="fa-solid ${dicon}" style="${dcolor};font-size:16px;"></i> ${getDisplayName(item)}</td>
          <td>${dtype}</td><td>${ddate}</td><td>${dsize}</td>`;
        tr.addEventListener('dblclick',()=>{if(item.type==='folder')navigate(item.id);else openNotepad(item.id);});
        tr.addEventListener('click',e=>{
          if(!e.ctrlKey)tbl.querySelectorAll('tr.selected').forEach(r=>r.classList.remove('selected'));
          tr.classList.add('selected');
        });
        tr.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();showExpItemCtx(item,e.clientX,e.clientY);});
        tbody.appendChild(tr);
      });
      mainPanel.appendChild(tbl);
    } else {
      items.forEach(item=>{
        const iconEl=document.createElement('div');
        iconEl.className='explorer-icon'+(item.hidden?' hidden-file':'');
        iconEl.dataset.id=item.id;
        const isFolder=item.type==='folder';
        iconEl.innerHTML=`
          <img src="${isFolder?'img/folder.png':'img/notepad.png'}" width="36" height="36"
               onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
          <i class="fa-solid ${isFolder?'fa-folder':'fa-file-lines'}" style="display:none;font-size:32px;${isFolder?'color:#f0b429':'color:#0c64b5'}"></i>
          <span>${getDisplayName(item)}</span>`;
        iconEl.addEventListener('dblclick',()=>{if(isFolder)navigate(item.id);else openNotepad(item.id);});
        iconEl.addEventListener('click',e=>{
          if(!e.ctrlKey)mainPanel.querySelectorAll('.explorer-icon.selected').forEach(i=>i.classList.remove('selected'));
          iconEl.classList.add('selected');
        });
        iconEl.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();showExpItemCtx(item,e.clientX,e.clientY);});
        mainPanel.appendChild(iconEl);
      });
    }
    statusBar.textContent=`${items.length} objeto(s)`;
    addrBar.querySelector('.exp-addr').value=node.name;
    win.querySelector('.title-bar-text').textContent=node.name+' – Explorador de Windows';
    win.dataset.explorerfolder=currentFolderId;
  }

  /* Menú contextual de ítem dentro del explorador */
  function showExpItemCtx(item,cx,cy){
    ctxTargetId=item.id;
    showContextMenu('file-menu',cx,cy);
  }

  /* Navegación */
  function navigate(id){
    currentFolderId=id;
    if(histStack[histIdx]!==id){histStack.splice(histIdx+1);histStack.push(id);histIdx=histStack.length-1;}
    buildSidebar();renderFolder();
  }

  /* Guardar referencia de refresh para arrastrar-soltar */
  win._refreshExplorer=()=>{buildSidebar();renderFolder();};

  /* Botones barra dirección */
  addrBar.querySelector('.exp-back').addEventListener('click',()=>{if(histIdx>0){histIdx--;currentFolderId=histStack[histIdx];buildSidebar();renderFolder();}});
  addrBar.querySelector('.exp-fwd' ).addEventListener('click',()=>{if(histIdx<histStack.length-1){histIdx++;currentFolderId=histStack[histIdx];buildSidebar();renderFolder();}});
  addrBar.querySelector('.exp-up'  ).addEventListener('click',()=>{const p=findParent(currentFolderId);if(p&&p.id!=='root')navigate(p.id);});
  addrBar.querySelector('.exp-refresh').addEventListener('click',()=>renderFolder());

  /* Clic derecho en panel vacío */
  mainPanel.addEventListener('contextmenu',e=>{
    if(e.target===mainPanel||e.target.classList.contains('explorer-main')){
      e.preventDefault();e.stopPropagation();
      /* Guardar contexto para las acciones */
      mainPanel._ctxFolderId=currentFolderId;
      showExpPanelCtx(e.clientX,e.clientY);
    }
  });
  function showExpPanelCtx(cx,cy){
    const m=document.getElementById('explorer-ctx');
    /* Actualizar labels de toggle */
    showContextMenu('explorer-ctx',cx,cy);
    /* Guardar folderId para las acciones */
    m.dataset.folderId=currentFolderId;
    m.dataset.winId=win.dataset.winId;
  }

  /* Drop desde escritorio */
  mainPanel.addEventListener('dragover',e=>{e.preventDefault();mainPanel.classList.add('drop-active');});
  mainPanel.addEventListener('dragleave',()=>mainPanel.classList.remove('drop-active'));
  mainPanel.addEventListener('drop',e=>{
    e.preventDefault();mainPanel.classList.remove('drop-active');
    if(activeDrag){
      copyItemsToFolder(activeDrag.ids,currentFolderId);
      renderFolder();activeDrag=null;
    }
  });

  buildSidebar();renderFolder();
}

/* Manejar acciones del menú contextual del panel del explorador */
document.addEventListener('click',e=>{
  const li=e.target.closest('[data-exaction]');
  if(!li)return;
  const action=li.dataset.exaction;
  const menu=document.getElementById('explorer-ctx');
  const folderId=menu.dataset.folderId;
  const folder=findItemById(folderId);
  closeAllMenus();
  if(!folder)return;
  switch(action){
    case 'new-folder':{
      const name=getUniqueName('Nueva carpeta',folder.children);
      folder.children.push({id:uid(),type:'folder',name,children:[],hidden:false,dateModified:now(),size:0});
      saveState();
      document.querySelectorAll(`.window[data-explorerfolder="${folderId}"]`).forEach(w=>w._refreshExplorer&&w._refreshExplorer());
      break;}
    case 'new-txt':{
      const name=getUniqueName('Nuevo documento.txt',folder.children);
      folder.children.push({id:uid(),type:'file',name,ext:'txt',content:'',hidden:false,dateModified:now(),size:0});
      saveState();
      document.querySelectorAll(`.window[data-explorerfolder="${folderId}"]`).forEach(w=>w._refreshExplorer&&w._refreshExplorer());
      break;}
    case 'paste': handlePasteInto(folderId); break;
    case 'refresh':
      document.querySelectorAll(`.window[data-explorerfolder="${folderId}"]`).forEach(w=>w._refreshExplorer&&w._refreshExplorer());
      break;
    case 'view-large': case 'view-medium': case 'view-small': case 'view-list': case 'view-details':
    case 'sort-name': case 'sort-type': case 'sort-date': case 'sort-size':
    case 'toggle-hidden': case 'toggle-ext': case 'toggle-nav':
      /* Pasado al estado global y refrescar exploradores */
      break;
  }
});

/* ============================================================
   9. BLOC DE NOTAS
   ============================================================ */
function openNotepad(fileId){
  const fileNode=fileId?findItemById(fileId):null;
  let dirty=false;
  const win=createWindow({title:(fileNode?fileNode.name:'Sin título')+' – Bloc de notas',icon:'fa-solid fa-file-lines',width:560,height:380,
    menuItems:[{label:'Archivo',action:'np-file'},{label:'Editar',action:'np-edit'},{label:'Ver',action:'np-view'}]});
  const content=win.querySelector('.window-content');
  content.style.cssText='display:flex;flex-direction:column;height:100%;';
  const cont=document.createElement('div');cont.className='notepad-container';
  const toolbar=document.createElement('div');toolbar.className='notepad-toolbar';
  toolbar.innerHTML=`<button class="np-save"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
    <button class="np-new"><i class="fa-solid fa-file"></i> Nuevo</button>
    <button class="np-print"><i class="fa-solid fa-print"></i> Imprimir</button>`;
  const ta=document.createElement('textarea');ta.className='notepad-textarea';
  ta.value=fileNode?(fileNode.content||''):'';ta.spellcheck=false;ta.placeholder='Escribe aquí...';
  let curFile=fileNode;
  ta.addEventListener('input',()=>{dirty=true;win.querySelector('.title-bar-text').textContent='*'+(curFile?curFile.name:'Sin título')+' – Bloc de notas';});
  toolbar.querySelector('.np-save').addEventListener('click',()=>{
    if(curFile){curFile.content=ta.value;curFile.size=ta.value.length;curFile.dateModified=now();}
    else{const df=findItemById('desktop-folder');const nm=getUniqueName('Nuevo documento.txt',df.children);
      curFile={id:uid(),type:'file',name:nm,ext:'txt',content:ta.value,hidden:false,dateModified:now(),size:ta.value.length};
      df.children.push(curFile);renderDesktop();}
    dirty=false;win.querySelector('.title-bar-text').textContent=curFile.name+' – Bloc de notas';saveState();
  });
  toolbar.querySelector('.np-new').addEventListener('click',()=>{
    if(dirty&&!confirm('¿Descartar cambios?'))return;
    ta.value='';curFile=null;dirty=false;win.querySelector('.title-bar-text').textContent='Sin título – Bloc de notas';
  });
  toolbar.querySelector('.np-print').addEventListener('click',()=>window.print());
  toolbar.querySelector('.np-saveas').addEventListener('click',()=>{const fname=curFile?curFile.name:'documento.txt';downloadFile(fname,ta.value,'text/plain');});
  cont.appendChild(toolbar);cont.appendChild(ta);content.appendChild(cont);
}

/* ============================================================
   10. PAINT
   ============================================================ */
function openPaint(){
  const win=createWindow({title:'Paint',icon:'fa-solid fa-palette',width:700,height:520});
  const content=win.querySelector('.window-content');
  content.style.cssText='display:flex;flex-direction:column;height:100%;overflow:hidden;';
  let tool='pencil',color='#000000',bgColor='#ffffff',lineWidth=3;
  const COLORS=['#000000','#ffffff','#ff0000','#00aa00','#0000ff','#ffff00','#ff00ff','#00ffff',
                '#ff8800','#8800ff','#888888','#cccccc','#ff9999','#99ff99','#9999ff','#ffcc99'];
  const container=document.createElement('div');container.className='paint-container';
  /* Toolbar */
  const tb=document.createElement('div');tb.className='paint-toolbar';
  const tools=[{id:'pencil',icon:'fa-pencil',tip:'Lápiz'},{id:'brush',icon:'fa-paintbrush',tip:'Pincel'},
    {id:'eraser',icon:'fa-eraser',tip:'Borrador'},{id:'line',icon:'fa-minus',tip:'Línea'},
    {id:'rect',icon:'fa-square',tip:'Rectángulo'},{id:'circle',icon:'fa-circle',tip:'Círculo'},
    {id:'fill',icon:'fa-fill-drip',tip:'Relleno'},{id:'text',icon:'fa-font',tip:'Texto'}];
  tools.forEach(t=>{
    const btn=document.createElement('button');btn.className='paint-tool-btn'+(tool===t.id?' active':'');
    btn.innerHTML=`<i class="fa-solid ${t.icon}"></i>`;btn.title=t.tip;btn.dataset.tool=t.id;
    btn.addEventListener('click',()=>{tool=t.id;tb.querySelectorAll('.paint-tool-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');});
    tb.appendChild(btn);
  });
  tb.appendChild(Object.assign(document.createElement('div'),{className:'paint-sep'}));
  /* Tamaño */
  const szSel=document.createElement('select');szSel.className='paint-size-select';
  [1,2,3,5,8,12,20].forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s+'px';if(s===3)o.selected=true;szSel.appendChild(o);});
  szSel.addEventListener('change',()=>lineWidth=+szSel.value);
  tb.appendChild(szSel);
  tb.appendChild(Object.assign(document.createElement('div'),{className:'paint-sep'}));
  /* Paleta de colores */
  COLORS.forEach(c=>{
    const sw=document.createElement('div');sw.className='paint-color-swatch'+(c==='#000000'?' selected':'');
    sw.style.background=c;sw.title=c;
    sw.addEventListener('click',e=>{
      if(e.shiftKey)bgColor=c;else color=c;
      tb.querySelectorAll('.paint-color-swatch').forEach(s=>s.classList.remove('selected'));sw.classList.add('selected');
    });
    tb.appendChild(sw);
  });
  /* Color personalizado */
  const colorPick=document.createElement('input');colorPick.type='color';colorPick.value=color;colorPick.style.cssText='width:28px;height:28px;border:1px solid #bbb;padding:1px;cursor:pointer;';
  colorPick.addEventListener('input',()=>{color=colorPick.value;});
  tb.appendChild(colorPick);
  /* Botones guardar/limpiar */
  tb.appendChild(Object.assign(document.createElement('div'),{className:'paint-sep'}));
  const clearBtn=document.createElement('button');clearBtn.className='paint-tool-btn';clearBtn.innerHTML='<i class="fa-solid fa-trash"></i>';clearBtn.title='Limpiar';
  clearBtn.addEventListener('click',()=>{ctx.fillStyle=bgColor;ctx.fillRect(0,0,canvas.width,canvas.height);});
  tb.appendChild(clearBtn);
  /* Guardar PNG */
  const savePngBtn=document.createElement('button');savePngBtn.className='paint-tool-btn';savePngBtn.innerHTML='<i class="fa-solid fa-floppy-disk"></i>';savePngBtn.title='Guardar como PNG';
  savePngBtn.addEventListener('click',()=>{canvas.toBlob(blob=>{
    const reader=new FileReader();reader.onload=ev=>{
      // Guardar en FS
      const pf=findItemById('pics-folder')||findItemById('desktop-folder');
      const name=getUniqueName('Pintura.png',pf.children);
      pf.children.push({id:uid(),type:'file',name,ext:'png',content:ev.target.result,hidden:false,dateModified:now(),size:blob.size});
      saveState();
      // Descargar al PC real
      downloadFile(name, ev.target.result, 'image/png');
    };
    reader.readAsDataURL(blob);
  },'image/png');});
  tb.appendChild(savePngBtn);
  /* Cargar imagen */
  const loadImgBtn=document.createElement('button');loadImgBtn.className='paint-tool-btn';loadImgBtn.innerHTML='<i class="fa-solid fa-folder-open"></i>';loadImgBtn.title='Abrir imagen PNG/JPG';
  const paintFileInput=document.createElement('input');paintFileInput.type='file';paintFileInput.accept='image/*';paintFileInput.style.display='none';
  paintFileInput.addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>{const img=new Image();img.onload=()=>{ctx.drawImage(img,0,0,canvas.width,canvas.height);};img.src=ev.target.result;};reader.readAsDataURL(file);paintFileInput.value='';});
  loadImgBtn.addEventListener('click',()=>paintFileInput.click());
  tb.appendChild(loadImgBtn);tb.appendChild(paintFileInput);
  /* Canvas */
  const wrap=document.createElement('div');wrap.className='paint-canvas-wrap';
  const canvas=document.createElement('canvas');canvas.id='paint-canvas';canvas.width=800;canvas.height=600;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
  wrap.appendChild(canvas);
  container.appendChild(tb);container.appendChild(wrap);content.appendChild(container);

  let drawing=false,lastX=0,lastY=0,startX=0,startY=0,snapshot=null;
  canvas.addEventListener('mousedown',e=>{
    drawing=true;
    const r=canvas.getBoundingClientRect(),scx=canvas.width/r.width,scy=canvas.height/r.height;
    lastX=startX=(e.clientX-r.left)*scx;lastY=startY=(e.clientY-r.top)*scy;
    if(tool==='fill'){floodFill(ctx,Math.round(startX),Math.round(startY),color);return;}
    if(['line','rect','circle'].includes(tool))snapshot=ctx.getImageData(0,0,canvas.width,canvas.height);
    ctx.beginPath();ctx.moveTo(lastX,lastY);
  });
  canvas.addEventListener('mousemove',e=>{
    if(!drawing)return;
    const r=canvas.getBoundingClientRect(),scx=canvas.width/r.width,scy=canvas.height/r.height;
    const cx=(e.clientX-r.left)*scx,cy=(e.clientY-r.top)*scy;
    ctx.strokeStyle=tool==='eraser'?bgColor:color;ctx.lineWidth=lineWidth;ctx.lineCap='round';ctx.lineJoin='round';
    if(tool==='pencil'||tool==='brush'||tool==='eraser'){
      ctx.lineTo(cx,cy);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,cy);
    } else if(snapshot){
      ctx.putImageData(snapshot,0,0);
      ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=lineWidth;
      if(tool==='line'){ctx.moveTo(startX,startY);ctx.lineTo(cx,cy);ctx.stroke();}
      else if(tool==='rect'){ctx.strokeRect(startX,startY,cx-startX,cy-startY);}
      else if(tool==='circle'){const rx=(cx-startX)/2,ry=(cy-startY)/2;ctx.ellipse(startX+rx,startY+ry,Math.abs(rx),Math.abs(ry),0,0,Math.PI*2);ctx.stroke();}
    }
    lastX=cx;lastY=cy;
  });
  canvas.addEventListener('mouseup',()=>{drawing=false;snapshot=null;ctx.beginPath();});
  canvas.addEventListener('mouseleave',()=>{if(drawing){drawing=false;snapshot=null;}});
}

/* Relleno simple por inundación */
function floodFill(ctx,sx,sy,fillColorHex){
  const img=ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height);
  const data=img.data,w=ctx.canvas.width,h=ctx.canvas.height;
  const idx=(x,y)=>(y*w+x)*4;
  const ti=idx(sx,sy);
  const tr=data[ti],tg=data[ti+1],tb=data[ti+2],ta=data[ti+3];
  const fc=parseInt(fillColorHex.slice(1),16);
  const fr=(fc>>16)&255,fg=(fc>>8)&255,fb=fc&255;
  if(tr===fr&&tg===fg&&tb===fb)return;
  const stack=[[sx,sy]];
  while(stack.length){
    const [x,y]=stack.pop();
    if(x<0||x>=w||y<0||y>=h)continue;
    const i=idx(x,y);
    if(data[i]!==tr||data[i+1]!==tg||data[i+2]!==tb||data[i+3]!==ta)continue;
    data[i]=fr;data[i+1]=fg;data[i+2]=fb;data[i+3]=255;
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  ctx.putImageData(img,0,0);
}

/* ============================================================
   11. CALCULADORA
   ============================================================ */
function openCalcApp(){
  const win=createWindow({title:'Calculadora',icon:'fa-solid fa-calculator',width:280,height:360});
  const content=win.querySelector('.window-content');
  content.style.padding='0';
  let expr='',result='0',waitingOperand=false,lastOp=null,lastNum=null;
  const cont=document.createElement('div');cont.className='calc-container';
  const exprDiv=document.createElement('div');exprDiv.className='calc-expr';
  const dispDiv=document.createElement('div');exprDiv.textContent='';dispDiv.textContent='0';
  const display=document.createElement('div');display.className='calc-display';
  display.appendChild(exprDiv);display.appendChild(dispDiv);
  const grid=document.createElement('div');grid.className='calc-buttons';
  const btns=[
    {l:'C',cls:'fn',fn:()=>{result='0';expr='';waitingOperand=false;lastOp=null;lastNum=null;update();}},
    {l:'±',cls:'fn',fn:()=>{result=String(-parseFloat(result)||0);update();}},
    {l:'%',cls:'fn',fn:()=>{result=String(parseFloat(result)/100);update();}},
    {l:'÷',cls:'op',fn:()=>applyOp('/')},
    {l:'7',cls:'num',fn:()=>input('7')},{l:'8',cls:'num',fn:()=>input('8')},{l:'9',cls:'num',fn:()=>input('9')},{l:'×',cls:'op',fn:()=>applyOp('*')},
    {l:'4',cls:'num',fn:()=>input('4')},{l:'5',cls:'num',fn:()=>input('5')},{l:'6',cls:'num',fn:()=>input('6')},{l:'−',cls:'op',fn:()=>applyOp('-')},
    {l:'1',cls:'num',fn:()=>input('1')},{l:'2',cls:'num',fn:()=>input('2')},{l:'3',cls:'num',fn:()=>input('3')},{l:'+',cls:'op',fn:()=>applyOp('+')},
    {l:'0',cls:'num span2',fn:()=>input('0')},{l:'.',cls:'num',fn:()=>inputDot()},{l:'=',cls:'eq',fn:()=>calcEquals()},
  ];
  function input(d){
    if(waitingOperand){result=d;waitingOperand=false;}
    else result=result==='0'?d:result+d;
    update();
  }
  function inputDot(){
    if(waitingOperand){result='0.';waitingOperand=false;}
    else if(!result.includes('.'))result+='.';
    update();
  }
  function applyOp(op){
    if(lastOp&&!waitingOperand){const n=parseFloat(result),r=eval(`${lastNum}${lastOp}${n}`);result=String(parseFloat(r.toFixed(10)));exprDiv.textContent=result+' '+opLabel(op);}
    else{exprDiv.textContent=result+' '+opLabel(op);}
    lastNum=parseFloat(result);lastOp=op;waitingOperand=true;update();
  }
  function calcEquals(){
    if(lastOp&&lastNum!==null){
      const n=parseFloat(result);const r=eval(`${lastNum}${lastOp}${n}`);
      exprDiv.textContent=`${lastNum} ${opLabel(lastOp)} ${n} =`;
      result=String(parseFloat(r.toFixed(10)));lastOp=null;lastNum=null;waitingOperand=true;update();
    }
  }
  function opLabel(op){return op==='*'?'×':op==='/'?'÷':op;}
  function update(){dispDiv.textContent=result;}
  btns.forEach(b=>{
    const btn=document.createElement('button');btn.className='calc-btn '+b.cls;btn.textContent=b.l;btn.addEventListener('click',b.fn);grid.appendChild(btn);
  });
  cont.appendChild(display);cont.appendChild(grid);content.appendChild(cont);
  /* Teclado */
  win.addEventListener('keydown',e=>{
    const map={'0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9','.':'.','+':'+','-':'-','*':'*','/':'/','Enter':'=','Escape':'C','Backspace':'BS'};
    const k=map[e.key];if(!k)return;
    if(k>='0'&&k<='9')input(k);
    else if(k==='.')inputDot();
    else if(['+','-','*','/'].includes(k))applyOp(k);
    else if(k==='=')calcEquals();
    else if(k==='C'){result='0';expr='';waitingOperand=false;lastOp=null;lastNum=null;update();}
    else if(k==='BS'){result=result.length>1?result.slice(0,-1):'0';update();}
  });
}

/* ============================================================
   12. SÍMBOLO DEL SISTEMA (CMD)
   ============================================================ */
function openCmd(){
  const win=createWindow({title:'Símbolo del sistema',icon:'fa-solid fa-terminal',width:600,height:380});
  const content=win.querySelector('.window-content');
  content.style.padding='0';
  const container=document.createElement('div');container.className='cmd-container';
  const output=document.createElement('div');output.className='cmd-output';
  const inputRow=document.createElement('div');inputRow.className='cmd-input-row';
  let cwd='C:\\Windows\\System32';
  const promptLabel=document.createElement('span');promptLabel.className='cmd-prompt-label';promptLabel.textContent=cwd+'>';
  const inputEl=document.createElement('input');inputEl.className='cmd-input';inputEl.type='text';inputEl.autocomplete='off';inputEl.spellcheck=false;
  inputRow.appendChild(promptLabel);inputRow.appendChild(inputEl);
  container.appendChild(output);container.appendChild(inputRow);content.appendChild(container);
  const history=[];let histPos=-1;
  function print(text,cls=''){const d=document.createElement('div');if(cls)d.className=cls;d.textContent=text;output.appendChild(d);output.scrollTop=output.scrollHeight;}
  print('Microsoft Windows [Versión 6.1.7601]','cmd-prompt');
  print('Copyright (c) 2009 Microsoft Corporation. Todos los derechos reservados.','cmd-prompt');
  print('');
  function runCmd(raw){
    const trimmed=raw.trim();if(!trimmed)return;
    history.unshift(trimmed);histPos=-1;
    print(cwd+'>'+trimmed,'cmd-prompt');
    const parts=trimmed.split(/\s+/);const cmd=parts[0].toLowerCase();const args=parts.slice(1);
    switch(cmd){
      case 'help':
        print('Comandos disponibles:');
        ['dir','cd','cls','echo','type','date','time','ver','mkdir','color','exit','whoami','ipconfig','ping','tasklist','systeminfo'].forEach(c=>print('  '+c));
        break;
      case 'dir':{
        const folder=findItemById('desktop-folder');
        print(' Directorio de '+cwd);print('');
        folder.children.forEach(c=>{const isDir=c.type==='folder';print(` ${isDir?'<DIR>':'     '}\t${c.name}`);});
        print('');print(`\t${folder.children.length} archivo(s)`);break;}
      case 'echo': print(args.join(' '),'cmd-success');break;
      case 'cls': output.innerHTML='';break;
      case 'date': print(new Date().toLocaleDateString('es'),'cmd-success');break;
      case 'time': print(new Date().toLocaleTimeString('es'),'cmd-success');break;
      case 'ver': print('Microsoft Windows [Versión 6.1.7601]','cmd-success');break;
      case 'whoami': print(sysConfig.username,'cmd-success');break;
      case 'cd':
        if(!args[0]||args[0]==='..'){if(cwd.includes('\\')&&cwd!=='C:\\'){cwd=cwd.slice(0,cwd.lastIndexOf('\\'))||'C:\\';}}
        else cwd=cwd+'\\'+args[0];
        promptLabel.textContent=cwd+'>';break;
      case 'mkdir':{
        if(!args[0]){print('Falta el nombre de la carpeta.','cmd-error');break;}
        const df=findItemById('desktop-folder');
        df.children.push({id:uid(),type:'folder',name:args[0],children:[],hidden:false,dateModified:now(),size:0});
        renderDesktop();saveState();print('Carpeta creada: '+args[0],'cmd-success');break;}
      case 'ipconfig':
        print('Adaptador de Ethernet:');print('   Dirección IPv4: 192.168.1.105');print('   Máscara de subred: 255.255.255.0');print('   Puerta de enlace: 192.168.1.1');break;
      case 'ping':
        print(`Haciendo ping a ${args[0]||'localhost'} con 32 bytes de datos:`,'cmd-success');
        [1,2,3,4].forEach((_,i)=>setTimeout(()=>print(`Respuesta de ${args[0]||'127.0.0.1'}: bytes=32 tiempo=1ms TTL=128`,'cmd-success'),(i+1)*400));
        break;
      case 'tasklist':
        print('Nombre del proceso           PID  Sesión   Mem');
        ['System','explorer.exe','notepad.exe','chrome.exe'].forEach((p,i)=>print(`${p.padEnd(28)} ${(1000+i*100)}`));break;
      case 'systeminfo':
        print('Nombre de host:          '+sysConfig.username+'-PC');print('S.O.:                   Microsoft Windows 7 Professional');print('Versión:                6.1.7601');break;
      case 'color': print('Función de color disponible en GUI.','cmd-success');break;
      case 'exit': win.querySelector('.close-btn').click();break;
      case 'type':
        if(!args[0]){print('Falta el nombre de archivo.','cmd-error');break;}
        {const f=findItemById('readme-file');if(f)print(f.content||'(vacío)');else print('Archivo no encontrado.','cmd-error');}break;
      default: print(`'${parts[0]}' no se reconoce como un comando interno o externo.`,'cmd-error');
    }
  }
  inputEl.addEventListener('keydown',e=>{
    if(e.key==='Enter'){runCmd(inputEl.value);inputEl.value='';}
    if(e.key==='ArrowUp'){if(histPos<history.length-1)histPos++;inputEl.value=history[histPos]||'';}
    if(e.key==='ArrowDown'){if(histPos>0)histPos--;inputEl.value=history[histPos]||'';}
  });
  setTimeout(()=>inputEl.focus(),100);
}

/* ============================================================
   13. SOLITARIO
   ============================================================ */
function openSolitaire(){
  const win=createWindow({title:'Solitario',icon:'fa-solid fa-heart',width:580,height:440});
  const content=win.querySelector('.window-content');
  content.style.padding='0';
  const container=document.createElement('div');container.className='solitaire-container';

  const suits=['♠','♥','♦','♣'];const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  let deck=[],tableau=[],foundations=[null,null,null,null],stock=[],waste=[];
  let score=0,selectedCard=null;

  function newGame(){
    deck=[];
    suits.forEach(s=>ranks.forEach(r=>deck.push({suit:s,rank:r,faceUp:false})));
    for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
    tableau=Array.from({length:7},()=>[]);foundations=[null,null,null,null];stock=[];waste=[];score=0;selectedCard=null;
    let di=0;
    for(let c=0;c<7;c++){for(let r=0;r<=c;r++){tableau[c].push({...deck[di],faceUp:r===c});di++;}}
    while(di<deck.length){stock.push({...deck[di],faceUp:false});di++;}
    render();
  }

  function rankVal(r){return ranks.indexOf(r);}
  function isRed(s){return s==='♥'||s==='♦';}

  function render(){
    container.innerHTML='';
    /* Cabecera */
    const header=document.createElement('div');header.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(0,0,0,.2);flex-shrink:0;';
    const newBtn=document.createElement('button');newBtn.className='solitaire-btn';newBtn.textContent='Nueva partida';newBtn.addEventListener('click',newGame);
    const scoreEl=document.createElement('span');scoreEl.className='solitaire-score';scoreEl.textContent='Puntos: '+score;
    header.appendChild(newBtn);header.appendChild(scoreEl);container.appendChild(header);

    /* Zona superior */
    const top=document.createElement('div');top.className='solitaire-top';
    /* Mazo */
    const stockSlot=document.createElement('div');stockSlot.className='card-slot';
    if(stock.length){
      const c=document.createElement('div');c.className='card face-down';c.textContent='🂠';c.style.cssText='top:0;left:0;font-size:2rem;display:flex;align-items:center;justify-content:center;';
      c.addEventListener('click',()=>{if(stock.length){const d=stock.pop();d.faceUp=true;waste.push(d);score=Math.max(0,score-2);render();}});
      stockSlot.appendChild(c);
    } else {
      const r=document.createElement('div');r.style.cssText='text-align:center;color:rgba(255,255,255,.4);padding:30px 0;font-size:1.5rem;cursor:pointer;';r.textContent='↺';
      r.addEventListener('click',()=>{stock=waste.reverse();waste=[];score=Math.max(0,score-100);render();});
      stockSlot.appendChild(r);
    }
    top.appendChild(stockSlot);
    /* Descarte */
    const wasteSlot=document.createElement('div');wasteSlot.className='card-slot';
    if(waste.length){const wc=waste[waste.length-1];wasteSlot.appendChild(makeCard(wc,true,'waste'));}
    top.appendChild(wasteSlot);
    top.appendChild(Object.assign(document.createElement('div'),{style:'flex:1'}));
    /* Fundaciones */
    foundations.forEach((f,fi)=>{
      const slot=document.createElement('div');slot.className='card-slot';
      slot.style.cssText='outline:2px dashed rgba(255,255,255,.4);';
      if(f){const fc=f[f.length-1];slot.appendChild(makeCard(fc,true,'foundation-'+fi));}
      else{const ph=document.createElement('div');ph.style.cssText='text-align:center;color:rgba(255,255,255,.3);padding:30px 0;';ph.textContent=suits[fi];slot.appendChild(ph);}
      slot.addEventListener('click',()=>{
        if(selectedCard){const[fromPile,fromIdx]=selectedCard;const card=getPileCard(fromPile,fromIdx);
          if(canPlaceFoundation(card,fi)){placeOnFoundation(fromPile,fromIdx,fi);score+=10;render();}
          else{clearSel();}
        }
      });
      top.appendChild(slot);
    });
    container.appendChild(top);

    /* Tableau */
    const bottom=document.createElement('div');bottom.className='solitaire-bottom';
    tableau.forEach((pile,pi)=>{
      const slot=document.createElement('div');slot.className='card-slot';
      slot.style.cssText='min-height:120px;flex:1;';
      pile.forEach((card,ci)=>{
        const cel=makeCard(card,card.faceUp,'tableau-'+pi+'-'+ci);
        cel.style.top=(ci*22)+'px';cel.style.position='absolute';
        slot.style.position='relative';slot.style.minHeight=(pile.length*22+100)+'px';
        cel.addEventListener('click',()=>{
          if(!card.faceUp){if(ci===pile.length-1){card.faceUp=true;score+=5;render();}return;}
          if(selectedCard&&(selectedCard[0]!=='tableau-'+pi||selectedCard[1]!==ci)){
            const[fromPile,fromIdx]=selectedCard;const srcCard=getPileCard(fromPile,fromIdx);
            if(canPlaceTableau(srcCard,pile)){
              moveToTableau(fromPile,fromIdx,pi);score+=5;
            } else clearSel();
            render();
          } else {
            selectedCard=['tableau-'+pi,ci];render();
          }
        });
        if(selectedCard&&selectedCard[0]==='tableau-'+pi&&selectedCard[1]===ci)cel.classList.add('selected-card');
        slot.appendChild(cel);
      });
      if(pile.length===0){slot.addEventListener('click',()=>{
        if(selectedCard){const[fp,fi]=selectedCard;const sc=getPileCard(fp,fi);
          if(sc&&sc.rank==='K'){moveToTableau(fp,fi,pi);render();}else clearSel();}});}
      bottom.appendChild(slot);
    });
    container.appendChild(bottom);
  }

  function makeCard(c,faceUp,key){
    const el=document.createElement('div');
    el.className='card '+(faceUp?((c.suit==='♥'||c.suit==='♦')?'hearts':'spades'):'face-down');
    if(faceUp){el.innerHTML=`<span>${c.rank}</span><span>${c.suit}</span><span class="suit-big">${c.suit}</span>`;}
    else el.textContent='';
    return el;
  }
  function getPileCard(ref,idx){
    if(ref==='waste')return waste[waste.length-1];
    if(ref.startsWith('foundation')){const fi=+ref.split('-')[1];const f=foundations[fi];return f?f[f.length-1]:null;}
    if(ref.startsWith('tableau')){const pi=+ref.split('-')[1];return tableau[pi][idx];}
    return null;
  }
  function canPlaceFoundation(card,fi){
    const f=foundations[fi];
    if(!f)return card.rank==='A';
    const top=f[f.length-1];return top.suit===card.suit&&rankVal(card.rank)===rankVal(top.rank)+1;
  }
  function canPlaceTableau(card,pile){
    if(!pile.length)return card.rank==='K';
    const top=pile[pile.length-1];if(!top.faceUp)return false;
    return isRed(card.suit)!==isRed(top.suit)&&rankVal(card.rank)===rankVal(top.rank)-1;
  }
  function placeOnFoundation(fromRef,fromIdx,fi){
    if(!foundations[fi])foundations[fi]=[];
    if(fromRef==='waste'){foundations[fi].push(waste.pop());}
    else if(fromRef.startsWith('tableau')){const pi=+fromRef.split('-')[1];foundations[fi].push(tableau[pi].pop());}
    selectedCard=null;
  }
  function moveToTableau(fromRef,fromIdx,toPi){
    let cards=[];
    if(fromRef==='waste'){cards=[waste.pop()];}
    else if(fromRef.startsWith('tableau')){const pi=+fromRef.split('-')[1];cards=tableau[pi].splice(fromIdx);}
    tableau[toPi].push(...cards);selectedCard=null;
  }
  function clearSel(){selectedCard=null;render();}

  content.appendChild(container);
  newGame();
}

/* ============================================================
   14. BUSCAMINAS
   ============================================================ */
function openMinesweeper(){
  const win=createWindow({title:'Buscaminas',icon:'fa-solid fa-bomb',width:380,height:440});
  const content=win.querySelector('.window-content');
  content.style.padding='0';
  const container=document.createElement('div');container.className='mines-container';
  const ROWS=9,COLS=9,MINES=10;
  let board=[],revealed=[],flagged=[],gameOver=false,firstClick=true,startTime=null,timerInt=null;

  function newGame(){
    board=Array.from({length:ROWS},()=>Array(COLS).fill(0));
    revealed=Array.from({length:ROWS},()=>Array(COLS).fill(false));
    flagged=Array.from({length:ROWS},()=>Array(COLS).fill(false));
    gameOver=false;firstClick=true;clearInterval(timerInt);startTime=null;render();
  }
  function placeMines(sr,sc){
    let placed=0;
    while(placed<MINES){const r=Math.floor(Math.random()*ROWS),c=Math.floor(Math.random()*COLS);
      if(board[r][c]===0&&!(r===sr&&c===sc)){board[r][c]=-1;placed++;}}
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      if(board[r][c]===-1)continue;let cnt=0;
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const nr=r+dr,nc=c+dc;if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&board[nr][nc]===-1)cnt++;}
      board[r][c]=cnt;
    }
  }
  function reveal(r,c){
    if(r<0||r>=ROWS||c<0||c>=COLS||revealed[r][c]||flagged[r][c])return;
    revealed[r][c]=true;if(board[r][c]===0)for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)reveal(r+dr,c+dc);
  }
  const numColors=['','#0000ff','#007b00','#ff0000','#00007b','#7b0000','#007b7b','#000000','#7b7b7b'];
  function render(){
    container.innerHTML='';
    const flagCount=flagged.flat().filter(Boolean).length;
    const header=document.createElement('div');header.className='mines-header';
    const mineCounter=document.createElement('div');mineCounter.className='mines-counter';mineCounter.textContent=String(MINES-flagCount).padStart(3,'0');
    const resetBtn=document.createElement('button');resetBtn.className='mines-reset-btn';resetBtn.textContent=gameOver==='win'?'😎':gameOver?'😵':'🙂';
    resetBtn.addEventListener('click',newGame);
    const timeCounter=document.createElement('div');timeCounter.className='mines-counter';timeCounter.id='mines-timer';timeCounter.textContent='000';
    header.appendChild(mineCounter);header.appendChild(resetBtn);header.appendChild(timeCounter);container.appendChild(header);
    const grid=document.createElement('div');grid.className='mines-grid';
    grid.style.gridTemplateColumns=`repeat(${COLS},24px)`;
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      const cell=document.createElement('div');cell.className='mines-cell';
      if(revealed[r][c]){
        cell.classList.add('revealed');
        if(board[r][c]===-1){cell.textContent='💣';cell.classList.add('mine-hit');}
        else if(board[r][c]>0){cell.textContent=board[r][c];cell.style.color=numColors[board[r][c]]||'#000';}
      } else if(flagged[r][c]){cell.textContent='🚩';cell.classList.add('flagged');}
      cell.addEventListener('click',()=>{
        if(gameOver||revealed[r][c]||flagged[r][c])return;
        if(firstClick){firstClick=false;placeMines(r,c);startTime=Date.now();timerInt=setInterval(()=>{const el=document.getElementById('mines-timer');if(el)el.textContent=String(Math.min(999,Math.floor((Date.now()-startTime)/1000))).padStart(3,'0');},1000);}
        if(board[r][c]===-1){revealed[r][c]=true;gameOver=true;clearInterval(timerInt);
          for(let i=0;i<ROWS;i++)for(let j=0;j<COLS;j++)if(board[i][j]===-1)revealed[i][j]=true;render();return;}
        reveal(r,c);
        const won=revealed.flat().filter(Boolean).length===ROWS*COLS-MINES;
        if(won){gameOver='win';clearInterval(timerInt);}
        render();
      });
      cell.addEventListener('contextmenu',e=>{e.preventDefault();if(!revealed[r][c]){flagged[r][c]=!flagged[r][c];render();}});
      grid.appendChild(cell);
    }
    container.appendChild(grid);
  }
  content.appendChild(container);newGame();
}

/* ============================================================
   15. MEDIA PLAYER
   ============================================================ */
function openMediaPlayer(){
  const win=createWindow({title:'Reproductor de Windows Media',icon:'fa-solid fa-circle-play',width:500,height:360});
  const content=win.querySelector('.window-content');content.style.padding='0';
  const cont=document.createElement('div');cont.className='mediaplayer-container';
  const tracks=[{name:'Sinfonía sin nombre',artist:'Artista desconocido',dur:240},{name:'Piano nocturno',artist:'Compositor anónimo',dur:180},{name:'Vals digital',artist:'Usuario',dur:120}];
  let cur=0,playing=false,prog=0,vol=80,intv=null;
  const screen=document.createElement('div');screen.className='mp-screen';
  const icn=document.createElement('i');icn.className='fa-solid fa-music';
  const info=document.createElement('div');info.className='mp-track-info';
  const progBar=document.createElement('div');progBar.className='mp-progress';
  const fill=document.createElement('div');fill.className='mp-progress-fill';fill.style.width='0%';
  progBar.appendChild(fill);
  screen.appendChild(icn);screen.appendChild(info);screen.appendChild(progBar);
  const controls=document.createElement('div');controls.className='mp-controls';
  const makeBtn=(icon,fn)=>{const b=document.createElement('button');b.className='mp-btn';b.innerHTML=`<i class="fa-solid ${icon}"></i>`;b.addEventListener('click',fn);return b;};
  function updateInfo(){info.innerHTML=`<div class="mp-track-name">${tracks[cur].name}</div><div class="mp-track-artist">${tracks[cur].artist}</div>`;}
  function play(){playing=true;intv=setInterval(()=>{prog=Math.min(100,prog+(100/tracks[cur].dur)*0.5);fill.style.width=prog+'%';if(prog>=100){next();}},500);}
  function pause(){playing=false;clearInterval(intv);}
  function next(){prog=0;cur=(cur+1)%tracks.length;updateInfo();if(playing){clearInterval(intv);play();}}
  function prev(){prog=0;cur=(cur-1+tracks.length)%tracks.length;updateInfo();if(playing){clearInterval(intv);play();}}
  const prevBtn=makeBtn('backward-step',prev);
  const playBtn=makeBtn('play',()=>{playing?pause():play();playBtn.innerHTML=`<i class="fa-solid ${playing?'pause':'play'}"></i>`;});
  const nextBtn=makeBtn('forward-step',next);
  const stopBtn=makeBtn('stop',()=>{pause();prog=0;fill.style.width='0%';playBtn.innerHTML='<i class="fa-solid fa-play"></i>';});
  const volWrap=document.createElement('div');volWrap.className='mp-volume';
  const volIco=document.createElement('i');volIco.className='fa-solid fa-volume-high';
  const volSlider=document.createElement('input');volSlider.type='range';volSlider.min=0;volSlider.max=100;volSlider.value=vol;volSlider.className='mp-volume';
  volWrap.appendChild(volIco);volWrap.appendChild(volSlider);
  controls.appendChild(prevBtn);controls.appendChild(stopBtn);controls.appendChild(playBtn);controls.appendChild(nextBtn);controls.appendChild(volWrap);
  cont.appendChild(screen);cont.appendChild(controls);content.appendChild(cont);
  updateInfo();
}

/* ============================================================
   16. INTERNET EXPLORER
   ============================================================ */
function openIE(){
  const win=createWindow({title:'Internet Explorer',icon:'fa-solid fa-globe',width:700,height:500});
  const content=win.querySelector('.window-content');content.style.padding='0';
  const cont=document.createElement('div');cont.className='ie-container';
  const tb=document.createElement('div');tb.className='ie-toolbar';
  const backBtn=document.createElement('button');backBtn.className='ie-nav-btn';backBtn.innerHTML='<i class="fa-solid fa-chevron-left"></i>';
  const fwdBtn=document.createElement('button');fwdBtn.className='ie-nav-btn';fwdBtn.innerHTML='<i class="fa-solid fa-chevron-right"></i>';
  const urlBar=document.createElement('input');urlBar.type='text';urlBar.className='ie-url-bar';urlBar.value='http://www.msn.com';
  const goBtn=document.createElement('button');goBtn.className='ie-nav-btn';goBtn.textContent='Ir';
  tb.appendChild(backBtn);tb.appendChild(fwdBtn);tb.appendChild(urlBar);tb.appendChild(goBtn);
  const ieContent=document.createElement('div');ieContent.className='ie-content';
  ieContent.innerHTML=`<div class="ie-homepage"><div class="ie-logo"><i class="fa-brands fa-internet-explorer"></i></div>
    <h2 style="color:#2980b9;margin-bottom:10px;">Windows Internet Explorer 8</h2>
    <p>Esta es una simulación de Internet Explorer.</p>
    <p style="margin-top:8px;color:#aaa;font-size:.78rem;">Navega escribiendo una URL arriba.</p></div>`;
  goBtn.addEventListener('click',()=>{
    const url=urlBar.value.trim();
    if(!url)return;
    ieContent.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:#888;">
      <i class="fa-solid fa-globe" style="font-size:3rem;color:#2980b9;"></i>
      <p style="font-size:.9rem;">Navegando a: ${url}</p>
      <p style="font-size:.78rem;">Este navegador es una simulación y no puede cargar páginas reales.</p></div>`;
  });
  urlBar.addEventListener('keydown',e=>{if(e.key==='Enter')goBtn.click();});
  cont.appendChild(tb);cont.appendChild(ieContent);content.appendChild(cont);
}

/* ============================================================
   17. WINDOWS DEFENDER
   ============================================================ */
function openDefender(){
  const win=createWindow({title:'Windows Defender',icon:'fa-solid fa-shield-halved',width:500,height:380});
  const content=win.querySelector('.window-content');
  let scanning=false,scanProg=0,threats=0;
  content.innerHTML=`<div class="defender-container">
    <div class="defender-status">
      <i class="fa-solid fa-shield-halved" id="def-icon"></i>
      <div><div id="def-title" style="font-weight:600;font-size:.95rem;">El equipo está protegido</div>
      <div id="def-sub" style="font-size:.8rem;color:#555;margin-top:3px;">Windows Defender activo y actualizado.</div></div>
    </div>
    <div class="defender-scan-area">
      <div style="font-weight:600;margin-bottom:8px;font-size:.85rem;">Análisis rápido</div>
      <div class="defender-progress"><div class="defender-progress-fill" id="def-prog" style="width:0%"></div></div>
      <div id="def-status" style="font-size:.78rem;color:#666;">Listo para analizar.</div>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button class="defender-btn" id="def-scan-btn">Iniciar análisis</button>
        <button class="defender-btn danger" id="def-update-btn">Actualizar definiciones</button>
      </div>
    </div>
    <div id="def-threats" style="padding:10px;font-size:.82rem;color:#27ae60;">✓ No se han detectado amenazas.</div>
  </div>`;
  const scanBtn=content.querySelector('#def-scan-btn');
  const progFill=content.querySelector('#def-prog');
  const defStatus=content.querySelector('#def-status');
  const defThreats=content.querySelector('#def-threats');
  scanBtn.addEventListener('click',()=>{
    if(scanning)return;scanning=true;scanProg=0;threats=0;
    scanBtn.disabled=true;defStatus.textContent='Analizando...';
    const intv=setInterval(()=>{
      scanProg=Math.min(100,scanProg+2);
      progFill.style.width=scanProg+'%';
      defStatus.textContent=`Analizando: C:\\Windows\\System32\\${['cmd.exe','explorer.exe','winlogon.exe','lsass.exe'][Math.floor(scanProg/25)%4]}`;
      if(scanProg>=100){
        clearInterval(intv);scanning=false;scanBtn.disabled=false;
        defStatus.textContent='Análisis completado.';
        defThreats.innerHTML=`<span style="color:#27ae60;">✓ Análisis completado. No se han encontrado amenazas. Tu equipo está seguro.</span>`;
      }
    },80);
  });
  content.querySelector('#def-update-btn').addEventListener('click',()=>{
    defStatus.textContent='Actualizando definiciones de virus...';
    setTimeout(()=>{defStatus.textContent='Definiciones actualizadas correctamente.';},2000);
  });
}

/* ============================================================
   18. MAPA DE CARACTERES
   ============================================================ */
function openCharMap(){
  const win=createWindow({title:'Mapa de caracteres',icon:'fa-solid fa-font',width:480,height:360});
  const content=win.querySelector('.window-content');content.style.padding='0';
  const cont=document.createElement('div');cont.className='charmap-container';
  const grid=document.createElement('div');grid.className='charmap-grid';
  let selected='';let collected='';
  const ranges=[];for(let i=0x20;i<=0x2FF;i++)ranges.push(i);
  ranges.forEach(code=>{
    const ch=String.fromCodePoint(code);
    const cell=document.createElement('div');cell.className='charmap-cell';cell.textContent=ch;cell.title=`U+${code.toString(16).toUpperCase().padStart(4,'0')} ${ch}`;
    cell.addEventListener('click',()=>{selected=ch;grid.querySelectorAll('.selected-char').forEach(c=>c.classList.remove('selected-char'));cell.classList.add('selected-char');info.textContent=`U+${code.toString(16).toUpperCase().padStart(4,'0')}: ${ch}`;});
    cell.addEventListener('dblclick',()=>{collected+=selected;outputInput.value=collected;});
    grid.appendChild(cell);
  });
  const outputArea=document.createElement('div');outputArea.className='charmap-output';
  const outputInput=document.createElement('input');outputInput.type='text';outputInput.readOnly=true;outputInput.placeholder='Haz doble clic para agregar...';
  const copyBtn=document.createElement('button');copyBtn.textContent='Copiar';
  copyBtn.addEventListener('click',()=>{if(outputInput.value){navigator.clipboard&&navigator.clipboard.writeText(outputInput.value).then(()=>alert('Copiado al portapapeles'));outputInput.value='';collected='';}});
  outputArea.appendChild(outputInput);outputArea.appendChild(copyBtn);
  const info=document.createElement('div');info.className='charmap-info';info.textContent='Haz clic en un carácter para seleccionarlo.';
  cont.appendChild(grid);cont.appendChild(outputArea);cont.appendChild(info);content.appendChild(cont);
}

/* ============================================================
   19. RECORTES
   ============================================================ */
function openSnipping(){
  const win=createWindow({title:'Recortes',icon:'fa-solid fa-crop',width:520,height:420});
  const content=win.querySelector('.window-content');content.style.padding='0';
  const cont=document.createElement('div');cont.className='snipping-container';
  const tb=document.createElement('div');tb.className='snipping-toolbar';
  const newBtn=document.createElement('button');newBtn.className='snip-btn';newBtn.innerHTML='<i class="fa-solid fa-plus"></i> Nuevo recorte';
  const saveBtn=document.createElement('button');saveBtn.className='snip-btn';saveBtn.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Guardar en Imágenes';saveBtn.disabled=true;
  const copyBtn2=document.createElement('button');copyBtn2.className='snip-btn';copyBtn2.innerHTML='<i class="fa-solid fa-download"></i> Descargar al PC';copyBtn2.disabled=true;
  tb.appendChild(newBtn);tb.appendChild(saveBtn);tb.appendChild(copyBtn2);
  const area=document.createElement('div');area.className='snipping-area';
  const ph=document.createElement('div');ph.className='snip-placeholder';
  ph.innerHTML='<i class="fa-solid fa-crop"></i><p>Haz clic en <b>Nuevo recorte</b> y arrastra para seleccionar la zona.</p>';
  const resultImg=document.createElement('img');resultImg.style.cssText='max-width:100%;max-height:100%;display:none;object-fit:contain;';
  area.appendChild(ph);area.appendChild(resultImg);
  let capturedDataUrl=null;
  newBtn.addEventListener('click',()=>{
    win.style.visibility='hidden';
    const overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;inset:0;z-index:99998;cursor:crosshair;background:rgba(0,0,0,.15);';
    const selRect=document.createElement('div');
    selRect.style.cssText='position:fixed;border:2px solid #0078d7;background:rgba(0,120,215,.08);pointer-events:none;z-index:99999;display:none;';
    document.body.appendChild(overlay);document.body.appendChild(selRect);
    let sx,sy,active=false;
    overlay.addEventListener('mousedown',e=>{active=true;sx=e.clientX;sy=e.clientY;selRect.style.display='block';});
    overlay.addEventListener('mousemove',e=>{if(!active)return;const x=Math.min(e.clientX,sx),y=Math.min(e.clientY,sy),w=Math.abs(e.clientX-sx),h=Math.abs(e.clientY-sy);selRect.style.left=x+'px';selRect.style.top=y+'px';selRect.style.width=w+'px';selRect.style.height=h+'px';});
    overlay.addEventListener('mouseup',e=>{
      if(!active)return;active=false;
      const x=Math.min(e.clientX,sx),y=Math.min(e.clientY,sy),w=Math.abs(e.clientX-sx),h=Math.abs(e.clientY-sy);
      overlay.remove();selRect.remove();win.style.visibility='visible';
      if(w<10||h<10)return;
      const c=document.createElement('canvas');c.width=w;c.height=h;
      const ctx2=c.getContext('2d');ctx2.fillStyle='#e0e8f0';ctx2.fillRect(0,0,w,h);
      ctx2.fillStyle='#444';ctx2.font='13px Segoe UI';ctx2.textAlign='center';ctx2.fillText('Recorte '+w+'×'+h+'px',w/2,h/2-8);ctx2.fillStyle='#888';ctx2.font='11px Segoe UI';ctx2.fillText('(captura simulada)',w/2,h/2+12);
      capturedDataUrl=c.toDataURL('image/png');
      resultImg.src=capturedDataUrl;resultImg.style.display='block';ph.style.display='none';
      saveBtn.disabled=false;copyBtn2.disabled=false;
    });
    const onKey=e=>{if(e.key==='Escape'){overlay.remove();selRect.remove();win.style.visibility='visible';document.removeEventListener('keydown',onKey);}};
    document.addEventListener('keydown',onKey);
  });
  saveBtn.addEventListener('click',()=>{
    if(!capturedDataUrl)return;
    const pf=findItemById('pics-folder');
    if(pf){const name=getUniqueName('Recorte.png',pf.children);pf.children.push({id:uid(),type:'file',name,ext:'png',content:capturedDataUrl,hidden:false,dateModified:now(),size:capturedDataUrl.length});saveState();alert('Guardado en Imágenes: '+name);}
    const a=document.createElement('a');a.href=capturedDataUrl;a.download='recorte.png';a.click();
  });
  copyBtn2.addEventListener('click',()=>{
    if(!capturedDataUrl)return;
    // Descargar directamente al PC
    downloadFile('recorte.png', capturedDataUrl, 'image/png');
  });
  cont.appendChild(tb);cont.appendChild(area);content.appendChild(cont);
}

/* ============================================================
   20. MI PC
   ============================================================ */
function openMyComputer(){
  const win=createWindow({title:'Mi PC',icon:'fa-solid fa-computer',width:520,height:360});
  const content=win.querySelector('.window-content');
  content.innerHTML=`
    <div class="mypc-section-title">Unidades de disco duro</div>
    <div class="mypc-drive"><i class="fa-solid fa-hard-drive mypc-drive-icon"></i>
      <div class="mypc-drive-info"><div class="mypc-drive-name">Disco local (C:)</div>
        <div class="mypc-drive-bar"><div class="mypc-drive-bar-fill" style="width:42%"></div></div>
        <div class="mypc-drive-size">167 GB libres de 287 GB</div></div></div>
    <div class="mypc-drive"><i class="fa-solid fa-hard-drive mypc-drive-icon" style="color:#aaa;"></i>
      <div class="mypc-drive-info"><div class="mypc-drive-name">Datos (D:)</div>
        <div class="mypc-drive-bar"><div class="mypc-drive-bar-fill" style="width:76%;background:linear-gradient(90deg,#e67e22,#f39c12)"></div></div>
        <div class="mypc-drive-size">57 GB libres de 238 GB</div></div></div>
    <div class="mypc-section-title" style="margin-top:10px;">Dispositivos con almacenamiento extraíble</div>
    <div class="mypc-drive"><i class="fa-solid fa-compact-disc mypc-drive-icon" style="color:#888;"></i>
      <div class="mypc-drive-info"><div class="mypc-drive-name">DVD RW (E:)</div><div class="mypc-drive-size">Sin disco</div></div></div>`;
}

/* ============================================================
   21. RED
   ============================================================ */
function openNetworkWindow(){
  const win=createWindow({title:'Red',icon:'fa-solid fa-network-wired',width:480,height:320});
  const c=win.querySelector('.window-content');
  c.innerHTML=`<div style="padding:15px;font-size:.85rem;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:15px;">
      <i class="fa-solid fa-wifi" style="font-size:32px;color:#0c64b5;"></i>
      <div><div style="font-weight:600;">Red-Hogar-5G</div><div style="color:#888;">Conectado · Acceso a Internet</div></div></div>
    <table style="width:100%;border-collapse:collapse;font-size:.82rem;">
      <tr style="border-bottom:1px solid #eee;"><td style="padding:6px;color:#666;width:45%;">Dirección IPv4</td><td style="padding:6px;font-weight:600;">192.168.1.105</td></tr>
      <tr style="border-bottom:1px solid #eee;"><td style="padding:6px;color:#666;">Máscara de subred</td><td style="padding:6px;">255.255.255.0</td></tr>
      <tr style="border-bottom:1px solid #eee;"><td style="padding:6px;color:#666;">Puerta de enlace</td><td style="padding:6px;">192.168.1.1</td></tr>
      <tr><td style="padding:6px;color:#666;">DNS</td><td style="padding:6px;">8.8.8.8, 8.8.4.4</td></tr></table></div>`;
}

/* ============================================================
   22. PROPIEDADES (con pestañas y opciones de admin/oculto)
   ============================================================ */
function openProperties(itemId){
  const item=findItemById(itemId);if(!item)return;
  const types={folder:'Carpeta de archivos',file:'Archivo de texto',shortcut:'Acceso directo'};
  const size=item.type==='file'?formatSize(item.content?item.content.length:0):'—';
  const win=createWindow({title:'Propiedades de '+item.name,icon:'fa-solid fa-circle-info',width:340,height:320});
  const content=win.querySelector('.window-content');content.style.padding='0';
  const cont=document.createElement('div');cont.className='properties-container';
  cont.innerHTML=`
    <div class="properties-tabs">
      <div class="properties-tab active" data-tab="general">General</div>
      <div class="properties-tab" data-tab="security">Seguridad</div>
      <div class="properties-tab" data-tab="details">Detalles</div>
    </div>
    <div class="properties-panel active" data-panel="general">
      <table class="properties-table">
        <tr><td>Nombre</td><td>${item.name}</td></tr>
        <tr><td>Tipo</td><td>${types[item.type]||item.type}</td></tr>
        <tr><td>Tamaño</td><td>${size}</td></tr>
        <tr><td>Ubicación</td><td>${(findParent(itemId)||{}).name||'Escritorio'}</td></tr>
        <tr><td>Modificado</td><td>${item.dateModified?item.dateModified.slice(0,10):'—'}</td></tr>
      </table>
      <div class="prop-checkbox" style="margin-top:8px;padding:0 8px;">
        <input type="checkbox" id="prop-hidden-cb" ${item.hidden?'checked':''}>
        <label for="prop-hidden-cb">Oculto</label>
      </div>
      <div class="prop-admin-btn" style="margin:8px;">
        <i class="fa-solid fa-shield"></i>
        <span>Ejecutar como administrador</span>
      </div>
      <div style="padding:8px;"><button id="prop-apply" style="background:#0c64b5;color:#fff;border:none;border-radius:3px;padding:5px 14px;cursor:pointer;font-size:.82rem;">Aplicar</button></div>
    </div>
    <div class="properties-panel" data-panel="security">
      <table class="properties-table">
        <tr><td>Propietario</td><td>${sysConfig.username}</td></tr>
        <tr><td>Permisos</td><td>Control total</td></tr>
        <tr><td>UAC</td><td>${sysConfig.uac?'Activado':'Desactivado'}</td></tr>
      </table>
    </div>
    <div class="properties-panel" data-panel="details">
      <table class="properties-table">
        <tr><td>ID</td><td style="font-size:.72rem;color:#888;">${item.id}</td></tr>
        <tr><td>Extensión</td><td>${item.ext||'—'}</td></tr>
        <tr><td>Contenido</td><td>${item.type==='file'?((item.content||'').slice(0,40)+'…'):'—'}</td></tr>
      </table>
    </div>`;
  /* Pestañas */
  cont.querySelectorAll('.properties-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      cont.querySelectorAll('.properties-tab').forEach(t=>t.classList.remove('active'));
      cont.querySelectorAll('.properties-panel').forEach(p=>p.classList.remove('active'));
      tab.classList.add('active');
      cont.querySelector(`.properties-panel[data-panel="${tab.dataset.tab}"]`).classList.add('active');
    });
  });
  cont.querySelector('.prop-admin-btn').addEventListener('click',()=>alert('Ejecutando como administrador (simulado): '+item.name));
  const applyBtn=cont.querySelector('#prop-apply');
  if(applyBtn)applyBtn.addEventListener('click',()=>{
    const cb=cont.querySelector('#prop-hidden-cb');if(cb)item.hidden=cb.checked;saveState();renderDesktop();win.querySelector('.close-btn').click();
  });
  content.appendChild(cont);
}

/* ============================================================
   23. PANEL DE CONTROL FUNCIONAL
   ============================================================ */
function openControlPanel(){
  const win=createWindow({title:'Panel de control',icon:'fa-solid fa-sliders',width:640,height:460});
  const content=win.querySelector('.window-content');content.style.padding='0';
  const cont=document.createElement('div');cont.className='control-panel-body';

  const categories=[
    {id:'appearance',label:'Apariencia',icon:'fa-solid fa-palette'},
    {id:'accounts',label:'Cuentas de usuario',icon:'fa-solid fa-users'},
    {id:'network',label:'Red e Internet',icon:'fa-solid fa-network-wired'},
    {id:'sound',label:'Sonido',icon:'fa-solid fa-volume-high'},
    {id:'hardware',label:'Hardware y dispositivos',icon:'fa-solid fa-microchip'},
    {id:'system',label:'Sistema',icon:'fa-solid fa-computer'},
    {id:'security',label:'Seguridad',icon:'fa-solid fa-shield-halved'},
    {id:'clock',label:'Reloj e idioma',icon:'fa-solid fa-clock'},
    {id:'updates',label:'Windows Update',icon:'fa-solid fa-rotate'},
    {id:'programs',label:'Programas',icon:'fa-solid fa-puzzle-piece'},
  ];

  const catBar=document.createElement('div');catBar.className='cp-categories';
  categories.forEach(cat=>{
    const btn=document.createElement('button');btn.className='cp-cat-btn';btn.dataset.cat=cat.id;
    btn.innerHTML=`<i class="${cat.icon}"></i> ${cat.label}`;
    btn.addEventListener('click',()=>{
      catBar.querySelectorAll('.cp-cat-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      cpContent.querySelectorAll('.cp-section').forEach(s=>s.classList.remove('active'));
      cpContent.querySelector(`.cp-section[data-section="${cat.id}"]`).classList.add('active');
    });
    catBar.appendChild(btn);
  });

  const cpContent=document.createElement('div');cpContent.className='cp-content';

  function makeSection(id,html){const d=document.createElement('div');d.className='cp-section';d.dataset.section=id;d.innerHTML=html;cpContent.appendChild(d);}

  makeSection('appearance',`<div class="cp-setting-group"><h4>Barra de título de ventanas</h4>
    <div class="cp-setting-row"><label>Color</label><input type="color" class="cp-color-btn" id="cp-tb-color" value="${sysConfig.titlebarColor||'#1a6ea8'}"></div>
    <div class="cp-setting-row"><label>Efecto RGB ventanas</label><button class="s-toggle ${sysConfig.titlebarRgb?'on':''}" id="cp-tb-rgb"></button></div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;padding:6px 0;">
      ${['#1a6ea8','#c0392b','#27ae60','#8e44ad','#e67e22','#2c3e50','#16a085','#d35400','#6c5ce7','#1e272e'].map(c=>'<div style="width:26px;height:26px;background:'+c+';border-radius:4px;cursor:pointer;border:2px solid transparent;" data-cppreset="'+c+'" title="'+c+'"></div>').join('')}
    </div>
    <button class="cp-save-btn" id="cp-save-appearance">Aplicar color</button>
    </div>
    <div class="cp-setting-group"><h4>Barra de tareas</h4>
    <div class="cp-setting-row"><label>Efecto RGB taskbar</label><button class="s-toggle ${sysConfig.taskbarRgb?'on':''}" id="cp-taskbar-rgb"></button></div>
    </div>`);

  makeSection('accounts',`<div class="cp-setting-group"><h4>Cuenta de usuario</h4>
    <div class="cp-setting-row"><label>Nombre de usuario</label><input class="cp-input" id="cp-username" value="${sysConfig.username}"></div>
    <button class="cp-save-btn" id="cp-save-account">Guardar nombre</button></div>`);

  makeSection('sound',`<div class="cp-setting-group"><h4>Configuración de sonido</h4>
    <div class="cp-setting-row"><label>Sonido del sistema</label><button class="s-toggle ${sysConfig.sound?'on':''}" id="cp-sound-toggle"></button></div>
    <div class="cp-setting-row"><label>Volumen</label><input type="range" class="cp-range" id="cp-sound-vol" min="0" max="100" value="${sysConfig.soundVol}"></div></div>`);

  makeSection('hardware',`<div class="cp-setting-group"><h4>Mouse</h4>
    <div class="cp-setting-row"><label>Velocidad del puntero</label><input type="range" class="cp-range" id="cp-mouse-speed" min="1" max="10" value="${sysConfig.mouseSpeed}"></div></div>
    <div class="cp-setting-group"><h4>Teclado</h4>
    <div class="cp-setting-row"><label>Velocidad de repetición</label><input type="range" class="cp-range" id="cp-key-repeat" min="1" max="10" value="${sysConfig.keyboardRepeat}"></div></div>
    <button class="cp-save-btn" id="cp-save-hardware">Aplicar</button>`);

  makeSection('system',`<div class="cp-setting-group"><h4>Información del sistema</h4>
    <div class="cp-setting-row"><label>S.O.</label><span>Windows 7 Professional</span></div>
    <div class="cp-setting-row"><label>Versión</label><span>6.1.7601</span></div>
    <div class="cp-setting-row"><label>Procesador</label><span>Intel Core i7 @ 2.90 GHz</span></div>
    <div class="cp-setting-row"><label>RAM</label><span>8,00 GB</span></div>
    <div class="cp-setting-row"><label>Tipo de sistema</label><span>S.O. de 64 bits</span></div></div>`);

  makeSection('security',`<div class="cp-setting-group"><h4>Control de cuentas de usuario (UAC)</h4>
    <div class="cp-setting-row"><label>Notificar cambios</label><button class="s-toggle ${sysConfig.uac?'on':''}" id="cp-uac"></button></div></div>
    <div class="cp-setting-group"><h4>Windows Firewall</h4>
    <div class="cp-setting-row"><label>Estado</label><span style="color:#27ae60;font-weight:600;">Activado</span></div></div>`);

  makeSection('clock',`<div class="cp-setting-group"><h4>Zona horaria</h4>
    <div class="cp-setting-row"><label>Zona horaria</label>
    <select class="cp-select" id="cp-timezone">
      <option value="America/Montevideo" ${sysConfig.timezone==='America/Montevideo'?'selected':''}>América/Montevideo (UTC-3)</option>
      <option value="America/Buenos_Aires" ${sysConfig.timezone==='America/Buenos_Aires'?'selected':''}>América/Buenos Aires (UTC-3)</option>
      <option value="America/New_York" ${sysConfig.timezone==='America/New_York'?'selected':''}>América/Nueva York (UTC-5)</option>
      <option value="Europe/Madrid" ${sysConfig.timezone==='Europe/Madrid'?'selected':''}>Europa/Madrid (UTC+1)</option>
    </select></div></div>
    <div class="cp-setting-group"><h4>Idioma</h4>
    <div class="cp-setting-row"><label>Idioma del sistema</label>
    <select class="cp-select" id="cp-lang"><option value="es" selected>Español</option><option value="en">English</option></select></div></div>
    <button class="cp-save-btn" id="cp-save-clock">Aplicar</button>`);

  makeSection('updates',`<div class="cp-setting-group"><h4>Windows Update</h4>
    <div class="cp-setting-row"><label>Actualizaciones automáticas</label><button class="s-toggle ${sysConfig.autoUpdate?'on':''}" id="cp-autoupdate"></button></div>
    <div class="cp-setting-row"><label>Última actualización</label><span>${new Date().toLocaleDateString('es')}</span></div>
    <button class="cp-save-btn" id="cp-check-updates" style="margin-top:10px;">Buscar actualizaciones</button></div>`);

  makeSection('programs',`<div class="cp-setting-group"><h4>Programas predeterminados</h4>
    <div class="cp-setting-row"><label>Navegador predeterminado</label><span>Internet Explorer 8</span></div>
    <div class="cp-setting-row"><label>Editor de texto</label><span>Bloc de notas</span></div>
    <div class="cp-setting-row"><label>Reproductor multimedia</label><span>Windows Media Player</span></div></div>`);

  makeSection('network',`<div class="cp-setting-group"><h4>Red inalámbrica activa</h4>
    <div class="cp-setting-row"><label>Red</label><span>Red-Hogar-5G</span></div>
    <div class="cp-setting-row"><label>Estado</label><span style="color:#27ae60;">Conectado</span></div>
    <div class="cp-setting-row"><label>Velocidad</label><span>300 Mbps</span></div>
    <div class="cp-setting-row"><label>IP</label><span>192.168.1.105</span></div></div>`);

  /* Activar primer ítem */
  catBar.querySelector('[data-cat="appearance"]').classList.add('active');
  cpContent.querySelector('[data-section="appearance"]').classList.add('active');

  /* Eventos */
  setTimeout(()=>{
    /* Apariencia */
    const saveAppBtn=cpContent.querySelector('#cp-save-appearance');
    if(saveAppBtn)saveAppBtn.addEventListener('click',()=>{
      const tc=cpContent.querySelector('#cp-tb-color');if(tc)sysConfig.titlebarColor=tc.value;
      applyTitlebarStyle();saveState();
    });
    const cpTbRgb=cpContent.querySelector('#cp-tb-rgb');
    if(cpTbRgb)cpTbRgb.addEventListener('click',()=>{sysConfig.titlebarRgb=!sysConfig.titlebarRgb;cpTbRgb.classList.toggle('on',sysConfig.titlebarRgb);applyTitlebarStyle();saveState();});
    cpContent.querySelectorAll('[data-cppreset]').forEach(el=>{
      el.addEventListener('click',()=>{
        sysConfig.titlebarColor=el.dataset.cppreset;sysConfig.titlebarRgb=false;
        const tc=cpContent.querySelector('#cp-tb-color');if(tc)tc.value=el.dataset.cppreset;
        if(cpTbRgb)cpTbRgb.classList.remove('on');
        applyTitlebarStyle();saveState();
      });
    });
    const rgbToggle=cpContent.querySelector('#cp-taskbar-rgb');
    if(rgbToggle)rgbToggle.addEventListener('click',()=>{sysConfig.taskbarRgb=!sysConfig.taskbarRgb;rgbToggle.classList.toggle('on',sysConfig.taskbarRgb);applyTaskbarRgb();saveState();});

    /* Cuentas */
    const saveAccBtn=cpContent.querySelector('#cp-save-account');
    if(saveAccBtn)saveAccBtn.addEventListener('click',()=>{
      const un=cpContent.querySelector('#cp-username').value.trim();
      if(un){sysConfig.username=un;document.getElementById('start-username').textContent=un;saveState();}
    });

    /* Sonido */
    const soundToggle=cpContent.querySelector('#cp-sound-toggle');
    if(soundToggle)soundToggle.addEventListener('click',()=>{sysConfig.sound=!sysConfig.sound;soundToggle.classList.toggle('on',sysConfig.sound);saveState();});
    const volSlider=cpContent.querySelector('#cp-sound-vol');
    if(volSlider)volSlider.addEventListener('input',()=>{sysConfig.soundVol=+volSlider.value;saveState();});

    /* Hardware */
    const hwSave=cpContent.querySelector('#cp-save-hardware');
    if(hwSave)hwSave.addEventListener('click',()=>{
      const ms=cpContent.querySelector('#cp-mouse-speed');const kr=cpContent.querySelector('#cp-key-repeat');
      if(ms)sysConfig.mouseSpeed=+ms.value;if(kr)sysConfig.keyboardRepeat=+kr.value;saveState();alert('Configuración de hardware aplicada.');
    });

    /* Seguridad */
    const uacTog=cpContent.querySelector('#cp-uac');
    if(uacTog)uacTog.addEventListener('click',()=>{sysConfig.uac=!sysConfig.uac;uacTog.classList.toggle('on',sysConfig.uac);saveState();});

    /* Reloj */
    const clockSave=cpContent.querySelector('#cp-save-clock');
    if(clockSave)clockSave.addEventListener('click',()=>{
      const tz=cpContent.querySelector('#cp-timezone');const lg=cpContent.querySelector('#cp-lang');
      if(tz)sysConfig.timezone=tz.value;if(lg)sysConfig.language=lg.value;saveState();alert('Configuración de reloj aplicada.');
    });

    /* Updates */
    const autoTog=cpContent.querySelector('#cp-autoupdate');
    if(autoTog)autoTog.addEventListener('click',()=>{sysConfig.autoUpdate=!sysConfig.autoUpdate;autoTog.classList.toggle('on',sysConfig.autoUpdate);saveState();});
    const checkUpd=cpContent.querySelector('#cp-check-updates');
    if(checkUpd)checkUpd.addEventListener('click',()=>{checkUpd.textContent='Buscando...';setTimeout(()=>{checkUpd.textContent='✓ Windows está actualizado';checkUpd.style.background='#27ae60';},2000);});
  },100);

  cont.appendChild(catBar);cont.appendChild(cpContent);content.appendChild(cont);
}

/* ============================================================
   24. CONFIGURACIÓN DEL SISTEMA
   ============================================================ */
function openSettings(){
  const win=createWindow({title:'Configuración',icon:'fa-solid fa-gear',width:600,height:440});
  const content=win.querySelector('.window-content');content.style.padding='0';
  const cont=document.createElement('div');cont.className='settings-container';

  const sections=[
    {id:'personalization',label:'Personalización',icon:'fa-solid fa-palette'},
    {id:'accounts',label:'Cuentas',icon:'fa-solid fa-circle-user'},
    {id:'system-info',label:'Sistema',icon:'fa-solid fa-computer'},
    {id:'display',label:'Pantalla',icon:'fa-solid fa-display'},
    {id:'notifications',label:'Notificaciones',icon:'fa-solid fa-bell'},
    {id:'privacy',label:'Privacidad',icon:'fa-solid fa-lock'},
    {id:'about',label:'Acerca de',icon:'fa-brands fa-windows'},
  ];

  const sidebar=document.createElement('div');sidebar.className='settings-sidebar';
  const ul=document.createElement('ul');
  sections.forEach(s=>{
    const li=document.createElement('li');li.dataset.sec=s.id;
    li.innerHTML=`<i class="${s.icon}"></i> ${s.label}`;
    li.addEventListener('click',()=>{
      ul.querySelectorAll('li').forEach(l=>l.classList.remove('active'));li.classList.add('active');
      settingsContent.querySelectorAll('.settings-section').forEach(p=>p.classList.remove('active'));
      settingsContent.querySelector(`.settings-section[data-sec="${s.id}"]`).classList.add('active');
    });
    ul.appendChild(li);
  });
  sidebar.appendChild(ul);

  const settingsContent=document.createElement('div');settingsContent.className='settings-content';

  function addSection(id,html){const d=document.createElement('div');d.className='settings-section';d.dataset.sec=id;d.innerHTML=html;settingsContent.appendChild(d);}

  addSection('personalization',`<h3>Personalización</h3>
    <div style="background:#f0f4ff;border:1px solid #d0d8f0;border-radius:6px;padding:10px;margin-bottom:10px;">
      <div style="font-weight:700;color:#0c64b5;font-size:.85rem;margin-bottom:8px;">🎨 Color de barra de título</div>
      <div class="settings-row"><label>Color sólido</label><input type="color" id="s-tb-color" value="${sysConfig.titlebarColor||'#1a6ea8'}" style="width:44px;height:28px;cursor:pointer;border:1px solid #bbb;"></div>
      <div class="settings-row"><label>Efecto RGB ventanas</label><button class="s-toggle ${sysConfig.titlebarRgb?'on':''}" id="s-tb-rgb"></button></div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px;">
        ${['#1a6ea8','#c0392b','#27ae60','#8e44ad','#e67e22','#2c3e50','#16a085','#d35400','#6c5ce7','#1e272e'].map(c=>'<div style="width:26px;height:26px;background:'+c+';border-radius:4px;cursor:pointer;border:2px solid transparent;" data-tbpreset="'+c+'" title="'+c+'"></div>').join('')}
      </div>
    </div>
    <div style="background:#f0f4ff;border:1px solid #d0d8f0;border-radius:6px;padding:10px;margin-bottom:10px;">
      <div style="font-weight:700;color:#0c64b5;font-size:.85rem;margin-bottom:8px;">📋 Barra de tareas</div>
      <div class="settings-row"><label>Efecto RGB taskbar</label><button class="s-toggle ${sysConfig.taskbarRgb?'on':''}" id="s-rgb"></button></div>
    </div>
    <div style="background:#f0f4ff;border:1px solid #d0d8f0;border-radius:6px;padding:10px;margin-bottom:10px;">
      <div style="font-weight:700;color:#0c64b5;font-size:.85rem;margin-bottom:8px;">🖼 Fondo de escritorio</div>
      <div class="settings-row"><label>Imagen</label><span style="font-size:.75rem;color:#888;">Coloca wallpaper.jpg en img/</span></div>
    </div>
    <button class="s-save-btn" id="s-save-personal">Aplicar cambios</button>`);

  addSection('accounts',`<h3>Cuentas de usuario</h3>
    <div class="settings-row"><label>Nombre de usuario</label><input class="s-input" id="s-username" value="${sysConfig.username}"></div>
    <div class="settings-row"><label>Tipo de cuenta</label><select class="s-select"><option selected>Administrador</option><option>Usuario estándar</option></select></div>
    <button class="s-save-btn" id="s-save-account">Guardar</button>`);

  addSection('system-info',`<h3>Información del sistema</h3>
    <div class="settings-row"><label>Sistema operativo</label><span>Windows 7 Professional</span></div>
    <div class="settings-row"><label>Versión</label><span>6.1.7601 SP1</span></div>
    <div class="settings-row"><label>Procesador</label><span>Intel Core i7-3770 @ 3.40 GHz</span></div>
    <div class="settings-row"><label>Memoria RAM</label><span>8,00 GB</span></div>
    <div class="settings-row"><label>Tipo de sistema</label><span>S.O. de 64 bits</span></div>
    <div class="settings-row"><label>Resolución</label><select class="s-select" id="s-resolution">
      <option value="1920x1080" ${sysConfig.screenRes==='1920x1080'?'selected':''}>1920×1080</option>
      <option value="1280x720"  ${sysConfig.screenRes==='1280x720'?'selected':''}>1280×720</option>
      <option value="1366x768"  ${sysConfig.screenRes==='1366x768'?'selected':''}>1366×768</option>
    </select></div>
    <button class="s-save-btn" id="s-save-system">Aplicar</button>`);

  addSection('display',`<h3>Pantalla</h3>
    <div class="settings-row"><label>Tamaño de texto</label><input type="range" class="s-range" id="s-font-scale" min="80" max="150" value="${Math.round(sysConfig.fontScale*100)}"></div>
    <div class="settings-row"><label>Brillo (simulado)</label><input type="range" class="s-range" min="50" max="100" value="100"></div>
    <button class="s-save-btn" id="s-save-display">Aplicar</button>`);

  addSection('notifications',`<h3>Notificaciones</h3>
    <div class="settings-row"><label>Mostrar notificaciones</label><button class="s-toggle on" id="s-notif"></button></div>
    <div class="settings-row"><label>Sonido al notificar</label><button class="s-toggle ${sysConfig.sound?'on':''}" id="s-notif-sound"></button></div>`);

  addSection('privacy',`<h3>Privacidad</h3>
    <div class="settings-row"><label>Historial de actividades</label><button class="s-toggle on"></button></div>
    <div class="settings-row"><label>Diagnóstico y datos</label><button class="s-toggle on"></button></div>
    <div class="settings-row"><label>Ubicación</label><button class="s-toggle"></button></div>`);

  addSection('about',`<h3>Acerca de Windows 7</h3>
    <div style="text-align:center;padding:20px;">
      <i class="fa-brands fa-windows" style="font-size:4rem;color:#0c64b5;display:block;margin-bottom:12px;"></i>
      <div style="font-size:1.1rem;font-weight:600;color:#222;">Windows 7 Professional</div>
      <div style="color:#888;font-size:.82rem;margin-top:4px;">Versión 6.1.7601 Service Pack 1</div>
      <div style="color:#888;font-size:.78rem;margin-top:16px;">Simulación web desarrollada con HTML5, CSS3 y JavaScript.</div>
    </div>`);

  /* Activar primer sección */
  ul.querySelector('li').classList.add('active');
  settingsContent.querySelector('.settings-section').classList.add('active');

  /* Eventos */
  setTimeout(()=>{
    const rgbBtn=settingsContent.querySelector('#s-rgb');
    if(rgbBtn)rgbBtn.addEventListener('click',()=>{sysConfig.taskbarRgb=!sysConfig.taskbarRgb;rgbBtn.classList.toggle('on',sysConfig.taskbarRgb);applyTaskbarRgb();saveState();});
    const tbRgbBtn=settingsContent.querySelector('#s-tb-rgb');
    if(tbRgbBtn)tbRgbBtn.addEventListener('click',()=>{sysConfig.titlebarRgb=!sysConfig.titlebarRgb;tbRgbBtn.classList.toggle('on',sysConfig.titlebarRgb);applyTitlebarStyle();saveState();});
    settingsContent.querySelectorAll('[data-tbpreset]').forEach(el=>{
      el.addEventListener('click',()=>{
        sysConfig.titlebarColor=el.dataset.tbpreset;sysConfig.titlebarRgb=false;
        const tc=settingsContent.querySelector('#s-tb-color');if(tc)tc.value=el.dataset.tbpreset;
        const tr=settingsContent.querySelector('#s-tb-rgb');if(tr)tr.classList.remove('on');
        applyTitlebarStyle();saveState();
      });
    });
    const savePersonal=settingsContent.querySelector('#s-save-personal');
    if(savePersonal)savePersonal.addEventListener('click',()=>{
      const tc=settingsContent.querySelector('#s-tb-color');if(tc)sysConfig.titlebarColor=tc.value;
      sysConfig.wallpaper='url("img/wallpaper.jpg") center/cover no-repeat, linear-gradient(135deg,'+sysConfig.wallpaperColor+','+sysConfig.wallpaperColor+'99)';
      applySystemConfig();saveState();
    });
    const saveAcc=settingsContent.querySelector('#s-save-account');
    if(saveAcc)saveAcc.addEventListener('click',()=>{
      const un=settingsContent.querySelector('#s-username').value.trim();
      if(un){sysConfig.username=un;document.getElementById('start-username').textContent=un;saveState();}
    });
    const saveSys=settingsContent.querySelector('#s-save-system');
    if(saveSys)saveSys.addEventListener('click',()=>{
      const res=settingsContent.querySelector('#s-resolution');if(res)sysConfig.screenRes=res.value;saveState();alert('Configuración aplicada.');
    });
    const saveDisp=settingsContent.querySelector('#s-save-display');
    if(saveDisp)saveDisp.addEventListener('click',()=>{
      const fs=settingsContent.querySelector('#s-font-scale');if(fs){sysConfig.fontScale=+fs.value/100;applySystemConfig();saveState();}
    });
  },100);

  cont.appendChild(sidebar);cont.appendChild(settingsContent);content.appendChild(cont);
}

/* ============================================================
   25. APLICAR CONFIGURACIÓN DEL SISTEMA
   ============================================================ */
function applySystemConfig(){
  /* Fondo del escritorio */
  document.getElementById('desktop').style.background=sysConfig.wallpaper;
  /* Escala de fuente */
  document.documentElement.style.fontSize=(sysConfig.fontScale*13)+'px';
  /* RGB taskbar - toggle class instead of inline style to avoid specificity issues */
  applyTaskbarRgb();
  /* Barras de título de ventanas */
  applyTitlebarStyle();
  /* Nombre usuario */
  const su=document.getElementById('start-username');if(su)su.textContent=sysConfig.username;
}

function applyTaskbarRgb(){
  const taskbar=document.querySelector('.taskbar');
  if(!taskbar)return;
  // Quitar clase siempre primero
  taskbar.classList.remove('taskbar-rgb');
  // Si está activo, añadir después de un frame para reiniciar animación
  if(sysConfig.taskbarRgb){
    requestAnimationFrame(()=>taskbar.classList.add('taskbar-rgb'));
  }
}

function applyTitlebarStyle(){
  let styleEl=document.getElementById('dyn-titlebar');
  if(!styleEl){styleEl=document.createElement('style');styleEl.id='dyn-titlebar';document.head.appendChild(styleEl);}
  if(sysConfig.titlebarRgb){
    styleEl.textContent=`@keyframes titleRgb{
      0%{background:linear-gradient(180deg,#ff8888,#cc2222);}
      17%{background:linear-gradient(180deg,#ffcc44,#cc8800);}
      33%{background:linear-gradient(180deg,#88ff88,#22aa22);}
      50%{background:linear-gradient(180deg,#44eeff,#0088cc);}
      67%{background:linear-gradient(180deg,#aa88ff,#5522cc);}
      83%{background:linear-gradient(180deg,#ff88cc,#cc2288);}
      100%{background:linear-gradient(180deg,#ff8888,#cc2222);}
    }.title-bar{animation:titleRgb 6s linear infinite!important;}`;
  } else {
    const c=sysConfig.titlebarColor||'#1a6ea8';
    const h=c.replace('#','');
    const r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16);
    const light=`rgb(${Math.min(255,r+60)},${Math.min(255,g+60)},${Math.min(255,b+60)})`;
    const dark=`rgb(${Math.max(0,r-30)},${Math.max(0,g-30)},${Math.max(0,b-30)})`;
    styleEl.textContent=`.title-bar{background:linear-gradient(180deg,${light},${c} 40%,${dark})!important;animation:none!important;}`;
  }
}

/* ============================================================
   26. PAPELERA
   ============================================================ */
function openRecycleBin(){
  const win=createWindow({title:'Papelera de reciclaje',icon:'fa-solid fa-trash-can',width:560,height:340});
  const content=win.querySelector('.window-content');
  if(recycleBin.length===0){
    content.innerHTML='<p style="color:#999;padding:20px;font-size:.85rem;">La Papelera de reciclaje está vacía.</p>';return;
  }
  const ul=document.createElement('ul');ul.style.cssText='list-style:none;padding:10px;';
  recycleBin.forEach((entry,i)=>{
    const li=document.createElement('li');li.style.cssText='display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid #eee;font-size:.85rem;';
    li.innerHTML=`<i class="fa-solid ${entry.item.type==='folder'?'fa-folder':'fa-file-lines'}" style="color:#888;"></i>
      <span style="flex:1;">${entry.item.name}</span>
      <button style="background:#e0f0ff;color:#0c64b5;border:1px solid #0c64b5;border-radius:3px;padding:3px 8px;cursor:pointer;font-size:.78rem;" data-idx="${i}">
        <i class="fa-solid fa-rotate-left"></i> Restaurar</button>`;
    li.querySelector('button').addEventListener('click',()=>{restoreFromBin(i);win.querySelector('.close-btn').click();});
    ul.appendChild(li);
  });
  content.appendChild(ul);
}
function restoreFromBin(idx){
  if(idx<0||idx>=recycleBin.length)return;
  const {item,originalParentId}=recycleBin[idx];
  const parent=findItemById(originalParentId)||findItemById('desktop-folder');
  parent.children.push(item);recycleBin.splice(idx,1);
  updateRecycleBinIcon();renderDesktop();saveState();
}
function emptyRecycleBin(){
  if(!recycleBin.length){alert('La Papelera ya está vacía.');return;}
  if(!confirm(`¿Eliminar definitivamente ${recycleBin.length} elemento(s)?`))return;
  recycleBin=[];updateRecycleBinIcon();saveState();
}

/* ============================================================
   27. COPIAR / CORTAR / PEGAR
   ============================================================ */
function handleCut(id){clipboard={action:'cut',ids:[id]};}
function handleCopy(id){clipboard={action:'copy',ids:[id]};}
function handlePasteInto(destFolderId){
  if(!clipboard.ids.length)return;
  const dest=findItemById(destFolderId);if(!dest||!dest.children)return;
  clipboard.ids.forEach(id=>{
    const item=findItemById(id);if(!item)return;
    const clone=JSON.parse(JSON.stringify(item));clone.id=uid();clone.name=getUniqueName(item.name,dest.children);
    dest.children.push(clone);
    if(clipboard.action==='cut'){const p=findParent(id);if(p)p.children=p.children.filter(c=>c.id!==id);}
  });
  if(clipboard.action==='cut')clipboard={action:null,ids:[]};
  renderDesktop();saveState();
}

/* ============================================================
   28. MENÚS CONTEXTUALES – ACCIONES
   ============================================================ */
function handleDesktopMenuAction(action){
  closeAllMenus();
  const df=findItemById('desktop-folder');
  switch(action){
    case 'icon-xlarge': iconSize='xlarge'; applyIconSize();iconSlots={};assignSlots();renderDesktop();saveState();break;
    case 'icon-large':  iconSize='large';  applyIconSize();iconSlots={};assignSlots();renderDesktop();saveState();break;
    case 'icon-medium': iconSize='medium'; applyIconSize();iconSlots={};assignSlots();renderDesktop();saveState();break;
    case 'icon-small':  iconSize='small';  applyIconSize();iconSlots={};assignSlots();renderDesktop();saveState();break;
    case 'sort-name': df.children.sort((a,b)=>a.name.localeCompare(b.name));iconSlots={};renderDesktop();saveState();break;
    case 'sort-type': df.children.sort((a,b)=>a.type.localeCompare(b.type));iconSlots={};renderDesktop();saveState();break;
    case 'sort-date': df.children.sort((a,b)=>(b.dateModified||'').localeCompare(a.dateModified||''));iconSlots={};renderDesktop();saveState();break;
    case 'sort-size': df.children.sort((a,b)=>(b.size||0)-(a.size||0));iconSlots={};renderDesktop();saveState();break;
    case 'refresh': renderDesktop();break;
    case 'new-folder':{const n=getUniqueName('Nueva carpeta',df.children);df.children.push({id:uid(),type:'folder',name:n,children:[],hidden:false,dateModified:now(),size:0});renderDesktop();saveState();break;}
    case 'new-txt':{const n=getUniqueName('Nuevo documento.txt',df.children);df.children.push({id:uid(),type:'file',name:n,ext:'txt',content:'',hidden:false,dateModified:now(),size:0});renderDesktop();saveState();break;}
    case 'toggle-hidden': showHidden=!showHidden;renderDesktop();saveState();break;
    case 'toggle-extensions': showExtensions=!showExtensions;renderDesktop();saveState();break;
    case 'toggle-nav-panel': showNavPanel=!showNavPanel;document.querySelectorAll('.explorer-sidebar').forEach(s=>s.classList.toggle('hidden-panel',!showNavPanel));saveState();break;
    case 'open-settings': openSettings();break;
  }
}

function handleFileMenuAction(action){
  closeAllMenus();if(!ctxTargetId)return;
  const item=findItemById(ctxTargetId);const parent=findParent(ctxTargetId);
  if(!item)return;
  switch(action){
    case 'open': openItem(ctxTargetId);break;
    case 'run-as-admin': alert('Ejecutando como administrador (simulado): '+item.name);break;
    case 'cut': handleCut(ctxTargetId);break;
    case 'copy-file': handleCopy(ctxTargetId);break;
    case 'rename':{const n=prompt('Nuevo nombre:',item.name);if(n&&n.trim()){item.name=n.trim();item.dateModified=now();renderDesktop();saveState();}break;}
    case 'shortcut':{const df=findItemById('desktop-folder');const sn=getUniqueName('Acceso directo a '+item.name,df.children);df.children.push({id:uid(),type:'shortcut',name:sn,targetId:item.id,hidden:false,dateModified:now()});renderDesktop();saveState();break;}
    case 'delete':{if(!parent)break;const idx=parent.children.indexOf(item);if(idx>-1)parent.children.splice(idx,1);recycleBin.push({item,originalParentId:parent.id});updateRecycleBinIcon();renderDesktop();saveState();break;}
    case 'toggle-hidden-file': item.hidden=!item.hidden;renderDesktop();saveState();break;
    case 'properties': openProperties(ctxTargetId);break;
    case 'download-file':{
      if(item.type==='file'){
        const ext2=(item.ext||'txt').toLowerCase();
        const mimeMap={txt:'text/plain',html:'text/html',css:'text/css',js:'application/javascript',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',scratch:'text/plain'};
        downloadFile(item.name, item.content||'', mimeMap[ext2]||'application/octet-stream');
      }
      break;}
  }
  ctxTargetId=null;
}

function handleMultiMenuAction(action){
  closeAllMenus();
  switch(action){
    case 'multi-delete':{
      const df=findItemById('desktop-folder');
      ctxMultiIds.forEach(id=>{
        const item=findItemById(id);const parent=findParent(id);
        if(item&&parent){parent.children=parent.children.filter(c=>c.id!==id);recycleBin.push({item,originalParentId:parent.id});}
      });
      updateRecycleBinIcon();renderDesktop();saveState();break;}
    case 'multi-cut': clipboard={action:'cut',ids:[...ctxMultiIds]};break;
    case 'multi-copy': clipboard={action:'copy',ids:[...ctxMultiIds]};break;
    case 'multi-hidden':
      ctxMultiIds.forEach(id=>{const item=findItemById(id);if(item)item.hidden=!item.hidden;});
      renderDesktop();saveState();break;
  }
  ctxMultiIds=[];
}

function handleTrayMenuAction(action){
  closeAllMenus();
  const screen=document.getElementById('shutdown-screen');
  const msg=document.getElementById('shutdown-msg');
  switch(action){
    case 'suspend': msg.textContent='Suspendiendo...';screen.classList.remove('hidden');setTimeout(()=>screen.classList.add('hidden'),2500);break;
    case 'restart': msg.textContent='Reiniciando...';screen.classList.remove('hidden');setTimeout(()=>location.reload(),2500);break;
    case 'shutdown': msg.textContent='Apagando...';screen.classList.remove('hidden');break;
    case 'clear-data':
      if(confirm('¿Borrar todos los datos guardados y reiniciar?\nSe eliminarán archivos, configuración e historial.')){
        localStorage.clear();
        msg.textContent='Borrando datos...';screen.classList.remove('hidden');
        setTimeout(()=>location.reload(),1800);
      }
      break;
  }
}

/* ============================================================
   29. SELECCIÓN MÚLTIPLE POR RECTÁNGULO
   ============================================================ */
function initSelectionBox(){
  const desktop=document.getElementById('desktop');
  const selBox=document.getElementById('selection-box');
  let sx=0,sy=0;
  desktop.addEventListener('mousedown',e=>{
    if(e.button!==0||e.target.closest('.icon'))return;
    clearSelection();sx=e.clientX;sy=e.clientY;
    selBox.style.cssText=`left:${sx}px;top:${sy}px;width:0;height:0;`;
    selBox.classList.remove('hidden');
    const mv=e=>{
      const x=Math.min(e.clientX,sx),y=Math.min(e.clientY,sy),w=Math.abs(e.clientX-sx),h=Math.abs(e.clientY-sy);
      selBox.style.left=x+'px';selBox.style.top=y+'px';selBox.style.width=w+'px';selBox.style.height=h+'px';
      const rect=selBox.getBoundingClientRect();
      document.querySelectorAll('.icon').forEach(icon=>{
        const ir=icon.getBoundingClientRect();
        const inter=!(ir.right<rect.left||ir.left>rect.right||ir.bottom<rect.top||ir.top>rect.bottom);
        icon.classList.toggle('selected',inter);
      });
    };
    const up=()=>{selBox.classList.add('hidden');document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
}

/* ============================================================
   30. RELOJ Y CALENDARIO
   ============================================================ */
function startClock(){
  function tick(){
    const now=new Date();
    document.getElementById('clock').textContent=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    document.getElementById('clock-date').textContent=`${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;
  }
  tick();setInterval(tick,1000);
}
function renderCalendar(){
  const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('cal-title').textContent=`${months[calDate.getMonth()]} ${calDate.getFullYear()}`;
  const tbody=document.getElementById('cal-body');tbody.innerHTML='';
  const today=new Date(),yr=calDate.getFullYear(),mo=calDate.getMonth();
  let fd=new Date(yr,mo,1).getDay();fd=fd===0?6:fd-1;
  const dim=new Date(yr,mo+1,0).getDate(),dip=new Date(yr,mo,0).getDate();
  let day=1,nd=1;
  for(let row=0;row<6;row++){
    const tr=document.createElement('tr');
    for(let col=0;col<7;col++){
      const td=document.createElement('td');const idx=row*7+col;
      if(idx<fd){td.textContent=dip-fd+1+idx;td.classList.add('other-month');}
      else if(day>dim){td.textContent=nd++;td.classList.add('other-month');}
      else{td.textContent=day;if(day===today.getDate()&&mo===today.getMonth()&&yr===today.getFullYear())td.classList.add('today');day++;}
      tr.appendChild(td);
    }
    tbody.appendChild(tr);if(day>dim&&row>3)break;
  }
}

/* ============================================================
   31. BANDEJA
   ============================================================ */
function updateWifiIcon(){
  const img=document.getElementById('wifi-img'),ico=document.getElementById('wifi-fallback');
  img.src=`img/taskbar-wifi-${trayState.wifiLevel}.png`;
  const cls=['fa-wifi-0','fa-wifi-1','fa-wifi-2','fa-wifi'];
  ico.className=`fa-solid ${cls[trayState.wifiLevel]||'fa-wifi'}`;
}
function updateBatteryIcon(){
  const img=document.getElementById('battery-img'),ico=document.getElementById('bat-fallback');
  img.src=`img/taskbar-bat-${trayState.batteryLevel}.png`;
  const cls=['fa-battery-empty','fa-battery-quarter','fa-battery-half','fa-battery-three-quarters','fa-battery-full'];
  ico.className=`fa-solid ${cls[trayState.batteryLevel]||'fa-battery-full'}`;
}

/* ============================================================
   32. EVENTOS GLOBALES
   ============================================================ */
function initEvents(){
  /* Clic derecho escritorio */
  document.getElementById('desktop').addEventListener('contextmenu',e=>{
    const icon=e.target.closest('.icon');
    if(icon){
      if(icon.dataset.id==='recyclebin'){e.preventDefault();showContextMenu('recyclebin-menu',e.clientX,e.clientY);}
      return; /* iconos dinámicos ya tienen su handler */
    }
    e.preventDefault();showContextMenu('desktop-menu',e.clientX,e.clientY);
  });

  /* Acciones menús */
  document.getElementById('desktop-menu').addEventListener('click',e=>{const li=e.target.closest('li[data-action]');if(li)handleDesktopMenuAction(li.dataset.action);});
  document.getElementById('file-menu').addEventListener('click',e=>{const li=e.target.closest('li[data-action]');if(li)handleFileMenuAction(li.dataset.action);});
  document.getElementById('multi-menu').addEventListener('click',e=>{const li=e.target.closest('li[data-action]');if(li)handleMultiMenuAction(li.dataset.action);});
  document.getElementById('recyclebin-menu').addEventListener('click',e=>{
    const li=e.target.closest('li[data-action]');if(!li)return;
    closeAllMenus();if(li.dataset.action==='open-bin')openRecycleBin();else emptyRecycleBin();
  });
  document.getElementById('tray-extra-menu').addEventListener('click',e=>{const li=e.target.closest('li[data-action]');if(li)handleTrayMenuAction(li.dataset.action);});

  /* Iconos fijos del sistema */
  [['mycomputer','openMyComputer'],['network','openNetworkWindow'],['controlpanel','openControlPanel']].forEach(([id,fn])=>{
    const el=document.getElementById('icon-'+id);if(!el)return;
    el.addEventListener('dblclick',()=>window[fn]());
    el.addEventListener('mousedown',e=>{e.stopPropagation();clearSelection();el.classList.add('selected');});
    el.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();ctxTargetId=null;});
  });
  const binIcon=document.getElementById('icon-recyclebin');
  if(binIcon){binIcon.addEventListener('dblclick',openRecycleBin);binIcon.addEventListener('mousedown',e=>{e.stopPropagation();clearSelection();binIcon.classList.add('selected');});}

  /* Botón inicio */
  document.getElementById('start-button').addEventListener('click',e=>{
    e.stopPropagation();
    const menu=document.getElementById('start-menu');
    const vis=!menu.classList.contains('hidden');
    closeAllMenus();if(!vis)menu.classList.remove('hidden');
  });

  /* Acciones menú inicio */
  document.getElementById('start-menu').addEventListener('click',e=>{
    const li=e.target.closest('li[data-action]');if(!li)return;
    closeAllMenus();
    if(li.dataset.action==='all-programs'){
      document.getElementById('start-menu').classList.add('hidden');
      document.getElementById('all-programs-panel').classList.remove('hidden');
    } else {
      runProgramAction(li.dataset.action);
    }
  });

  /* Panel todos los programas */
  const apSearch=document.getElementById('all-programs-search');
  if(apSearch){apSearch.addEventListener('input',()=>{const q=apSearch.value.toLowerCase();document.querySelectorAll('#all-programs-list > li[data-action]').forEach(li=>{li.style.display=(q===''||li.textContent.toLowerCase().includes(q))?'':'none';});});}
  document.getElementById('all-programs-list').addEventListener('click',e=>{
    const li=e.target.closest('li[data-action]');if(!li)return;
    closeAllMenus();runProgramAction(li.dataset.action);
  });
  /* Drag desde todos los programas al escritorio */
  document.querySelectorAll('#all-programs-list li[data-action]').forEach(li=>{
    li.draggable=true;
    li.addEventListener('dragstart',e=>{e.dataTransfer.setData('app-action',li.dataset.action);e.dataTransfer.setData('app-label',li.textContent.trim().slice(0,30));});
  });
  document.getElementById('desktop').addEventListener('dragover',e=>e.preventDefault());
  document.getElementById('desktop').addEventListener('drop',e=>{
    e.preventDefault();const action=e.dataTransfer.getData('app-action');const label=e.dataTransfer.getData('app-label');
    if(!action)return;const df=findItemById('desktop-folder');
    df.children.push({id:uid(),type:'shortcut',name:getUniqueName(label,df.children),appAction:action,hidden:false,dateModified:now()});
    renderDesktop();saveState();closeAllMenus();
  });
  document.getElementById('all-programs-back').addEventListener('click',()=>{
    document.getElementById('all-programs-panel').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
  });

  /* Reloj / Calendario */
  document.getElementById('clock-btn').addEventListener('click',e=>{
    e.stopPropagation();const cal=document.getElementById('calendar');
    const vis=!cal.classList.contains('hidden');closeAllMenus();if(!vis){renderCalendar();cal.classList.remove('hidden');}
  });
  document.getElementById('cal-prev').addEventListener('click',e=>{e.stopPropagation();calDate=new Date(calDate.getFullYear(),calDate.getMonth()-1,1);renderCalendar();});
  document.getElementById('cal-next').addEventListener('click',e=>{e.stopPropagation();calDate=new Date(calDate.getFullYear(),calDate.getMonth()+1,1);renderCalendar();});

  /* Wi-Fi / Batería */
  const wifiBtn=document.getElementById('wifi-btn');
  wifiBtn.addEventListener('click',e=>{e.stopPropagation();trayState.wifiLevel=(trayState.wifiLevel+1)%4;updateWifiIcon();saveState();});
  wifiBtn.addEventListener('mouseenter',e=>{const labels=['Sin señal','Débil','Media','Completa'];tooltipTimer=setTimeout(()=>showTooltip('Wi-Fi: '+labels[trayState.wifiLevel],e.clientX,e.clientY),600);});
  wifiBtn.addEventListener('mouseleave',hideTooltip);
  const batBtn=document.getElementById('battery-btn');
  batBtn.addEventListener('click',e=>{e.stopPropagation();trayState.batteryLevel=(trayState.batteryLevel+1)%5;updateBatteryIcon();saveState();});
  batBtn.addEventListener('mouseenter',e=>{const pct=[0,25,50,75,100];tooltipTimer=setTimeout(()=>showTooltip('Batería: '+pct[trayState.batteryLevel]+'%',e.clientX,e.clientY),600);});
  batBtn.addEventListener('mouseleave',hideTooltip);

  document.getElementById('tray-menu-btn').addEventListener('click',e=>{
    e.stopPropagation();const r=e.currentTarget.getBoundingClientRect();
    showContextMenu('tray-extra-menu',r.left,r.top-10);
  });

  /* Mostrar escritorio */
  document.getElementById('show-desktop-btn').addEventListener('click',()=>{
    const wins=document.querySelectorAll('.window');
    const anyVis=[...wins].some(w=>!w.classList.contains('minimized'));
    wins.forEach(w=>w.classList.toggle('minimized',anyVis));
    document.querySelectorAll('.taskbar-win-btn').forEach(b=>b.classList.toggle('active',!anyVis));
  });

  /* Cerrar menús globalmente */
  document.addEventListener('click',e=>{
    if(!e.target.closest('.context-menu')&&!e.target.closest('#start-menu')&&!e.target.closest('#start-button')&&
       !e.target.closest('#calendar')&&!e.target.closest('#clock-btn')&&!e.target.closest('#all-programs-panel'))
      closeAllMenus();
  });

  document.getElementById('windows-container').addEventListener('contextmenu',e=>e.preventDefault());
}

/* ============================================================
   NUEVAS APPS: runProgramAction, Scratch, Minecraft, F11
   ============================================================ */
function runProgramAction(action){
  const map={
    'open-explorer':()=>openExplorer('desktop-folder'),
    'open-notepad':()=>openNotepad(null),
    'open-paint':openPaint,'open-calc':openCalcApp,
    'open-mediaplayer':openMediaPlayer,'open-ie':openIE,
    'open-defender':openDefender,'open-charmap':openCharMap,
    'open-cmd':openCmd,'open-snipping':openSnipping,
    'open-settings':openSettings,'open-solitaire':openSolitaire,
    'open-minesweeper':openMinesweeper,'open-scratch':openScratch,
    'open-minecraft':openMinecraftLauncher,
    'open-pacman':openPacman,'open-dino':openDino,
    'open-leveldevil':openLevelDevil,'open-sushiparty':openSushiParty,
    'open-appleworm':openAppleWorm,'open-footballmasters':openFootballMasters,
    'open-longcat':openLongcat,'open-ironsnout':openIronSnout,'open-subwaysurfers':openSubwaySurfers,
    'open-mycomputer':openMyComputer,'open-documents':()=>openExplorer('docs-folder'),
    'open-controlpanel':openControlPanel,'open-network':openNetworkWindow,'open-recyclebin':openRecycleBin,
  };
  if(map[action])map[action]();
}


/* ============================================================
   SCRATCH 3.0 — Editor completo recreado
   ============================================================ */
function openScratch(fileId){
  const win=createWindow({title:'Scratch 3.0',icon:'fa-solid fa-code',width:1060,height:640});
  win.style.left='10px'; win.style.top='10px';
  const content=win.querySelector('.window-content');
  content.style.cssText='padding:0;display:flex;flex-direction:column;height:100%;overflow:hidden;';

  // ── PALETA DE BLOQUES ──────────────────────────────────────
  const CATS=[
    {id:'motion',  name:'Movimiento', color:'#4C97FF', dark:'#4280D7'},
    {id:'looks',   name:'Apariencia', color:'#9966FF', dark:'#855CD6'},
    {id:'sound',   name:'Sonido',     color:'#CF63CF', dark:'#BD42BD'},
    {id:'events',  name:'Eventos',    color:'#FFAB19', dark:'#EC9C13'},
    {id:'control', name:'Control',    color:'#FFAB19', dark:'#CF8B17'},
    {id:'sensing', name:'Sensores',   color:'#5CB1D6', dark:'#47A8D1'},
    {id:'operator',name:'Operadores', color:'#59C059', dark:'#46B946'},
    {id:'variable',name:'Variables',  color:'#FF8C1A', dark:'#DB6E00'},
  ];
  const BLOCKS={
    motion:[
      {label:'mover (10) pasos',      code:'move(10)'},
      {label:'girar ↻ (15) grados',   code:'rotate(15)'},
      {label:'girar ↺ (15) grados',   code:'rotateL(15)'},
      {label:'ir a x: (0) y: (0)',    code:'goto(0,0)'},
      {label:'apuntar en dirección (90)',code:'direction(90)'},
      {label:'cambiar x por (10)',    code:'changeX(10)'},
      {label:'cambiar y por (10)',    code:'changeY(10)'},
      {label:'fijar x a (0)',         code:'setX(0)'},
      {label:'fijar y a (0)',         code:'setY(0)'},
    ],
    looks:[
      {label:'decir [Hola] por (2) segundos', code:'say("Hola",2)'},
      {label:'decir [Hola]',          code:'say("Hola")'},
      {label:'mostrar',               code:'show()'},
      {label:'ocultar',               code:'hide()'},
      {label:'cambiar tamaño por (10)',code:'resize(10)'},
      {label:'fijar tamaño a (100)%', code:'setSize(100)'},
      {label:'siguiente disfraz',     code:'nextCostume()'},
    ],
    sound:[
      {label:'reproducir sonido [pop]',code:'playSound("pop")'},
      {label:'detener todos los sonidos',code:'stopSounds()'},
    ],
    events:[
      {label:'al presionar 🏁',       code:'// when_flag'},
      {label:'al presionar tecla [espacio]',code:'// when_key_space'},
      {label:'al hacer clic en este objeto',code:'// when_click'},
    ],
    control:[
      {label:'esperar (1) segundos',  code:'wait(1)'},
      {label:'repetir (10)',          code:'repeat(10)'},
      {label:'por siempre',           code:'forever'},
      {label:'fin',                   code:'end'},
      {label:'si <> entonces',        code:'if(true)'},
      {label:'si no',                 code:'else'},
      {label:'fin si',                code:'end_if'},
      {label:'detener [todo]',        code:'stop()'},
    ],
    sensing:[
      {label:'¿tocando [borde]?',     code:'touching("edge")'},
      {label:'posición x',            code:'getX()'},
      {label:'posición y',            code:'getY()'},
    ],
    operator:[
      {label:'() + ()',               code:'(a + b)'},
      {label:'() - ()',               code:'(a - b)'},
      {label:'() * ()',               code:'(a * b)'},
      {label:'() / ()',               code:'(a / b)'},
      {label:'número al azar entre (1) y (10)',code:'random(1,10)'},
      {label:'() = ()',               code:'(a == b)'},
      {label:'() > ()',               code:'(a > b)'},
      {label:'() < ()',               code:'(a < b)'},
    ],
    variable:[
      {label:'fijar [mi var] a (0)',  code:'setVar("miVar",0)'},
      {label:'cambiar [mi var] por (1)',code:'changeVar("miVar",1)'},
      {label:'mi var',                code:'getVar("miVar")'},
    ],
  };

  // ── ESTADO DEL SPRITE ─────────────────────────────────────
  let sprite={x:0,y:0,dir:90,size:100,visible:true,saying:null,sayTimer:null,costume:0};
  let running=false,runLoop=null,loopStack=[];
  let scriptLines=[];
  let curFn='Sin título';
  let scratchVars={};

  // ── LAYOUT: menubar | main ─────────────────────────────────
  // Menubar
  const menubar=document.createElement('div');
  menubar.style.cssText='background:#4D97FF;padding:0 8px;display:flex;align-items:center;height:38px;flex-shrink:0;gap:4px;border-bottom:2px solid #3380DD;';
  menubar.innerHTML=`
    <svg width="28" height="28" viewBox="0 0 58 58" style="flex-shrink:0;cursor:pointer">
      <circle cx="29" cy="29" r="29" fill="#FF6680"/>
      <circle cx="29" cy="29" r="20" fill="#fff"/>
      <circle cx="29" cy="29" r="13" fill="#FF6680" opacity=".6"/>
    </svg>
    <div style="display:flex;gap:2px;margin-left:6px;">
      ${['Archivo','Editar','Tutoriales'].map(m=>`<button class="sc-menu-item" style="background:transparent;border:none;color:#fff;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:.82rem;font-weight:600;">${m}</button>`).join('')}
    </div>
    <div style="flex:1;display:flex;justify-content:center;align-items:center;gap:8px;">
      <button id="sc-flag" title="Bandera verde (Ejecutar)" style="width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;background:#4CAF50;display:flex;align-items:center;justify-content:center;font-size:1.3rem;transition:filter .15s;">🏁</button>
      <button id="sc-stop" title="Detener" style="width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;background:#e74c3c;display:flex;align-items:center;justify-content:center;font-size:1.3rem;transition:filter .15s;">⏹</button>
    </div>
    <div style="display:flex;gap:6px;margin-right:4px;">
      <button id="sc-save" style="background:rgba(0,0,0,.2);color:#fff;border:none;border-radius:4px;padding:5px 12px;cursor:pointer;font-size:.78rem;font-weight:600;"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
      <button id="sc-load" style="background:rgba(0,0,0,.2);color:#fff;border:none;border-radius:4px;padding:5px 12px;cursor:pointer;font-size:.78rem;"><i class="fa-solid fa-folder-open"></i> Abrir</button>
      <button id="sc-new" style="background:rgba(0,0,0,.2);color:#fff;border:none;border-radius:4px;padding:5px 12px;cursor:pointer;font-size:.78rem;"><i class="fa-solid fa-file"></i> Nuevo</button>
    </div>
    <span id="sc-fname" style="color:rgba(255,255,255,.7);font-size:.72rem;min-width:80px;text-align:right;">${curFn}</span>`;

  // Main 3-col layout
  const main=document.createElement('div');
  main.style.cssText='flex:1;display:flex;overflow:hidden;';

  // ── COL 1: Block palette ───────────────────────────────────
  const palette=document.createElement('div');
  palette.style.cssText='width:220px;background:#f5f5f5;border-right:2px solid #ddd;display:flex;flex-direction:column;flex-shrink:0;overflow:hidden;';

  const catBar=document.createElement('div');
  catBar.style.cssText='display:flex;flex-wrap:wrap;gap:2px;padding:6px;background:#fff;border-bottom:1px solid #ddd;flex-shrink:0;';
  CATS.forEach(cat=>{
    const btn=document.createElement('button');
    btn.style.cssText=`background:${cat.color};color:#fff;border:none;border-radius:3px;padding:3px 6px;cursor:pointer;font-size:.65rem;font-weight:700;`;
    btn.textContent=cat.name;
    btn.addEventListener('click',()=>showCat(cat.id));
    catBar.appendChild(btn);
  });

  const blockList=document.createElement('div');
  blockList.style.cssText='flex:1;overflow-y:auto;padding:6px;';

  function showCat(catId){
    blockList.innerHTML='';
    const cat=CATS.find(c=>c.id===catId);
    if(!cat)return;
    (BLOCKS[catId]||[]).forEach(b=>{
      const el=document.createElement('div');
      el.style.cssText=`background:${cat.color};color:#fff;border-radius:5px;padding:7px 10px;margin:3px 0;cursor:grab;font-size:.75rem;font-weight:600;user-select:none;box-shadow:0 2px 4px rgba(0,0,0,.2);transition:transform .1s,filter .1s;`;
      el.textContent=b.label;el.draggable=true;
      el.addEventListener('mouseenter',()=>el.style.filter='brightness(1.15)');
      el.addEventListener('mouseleave',()=>el.style.filter='');
      el.addEventListener('dragstart',e=>e.dataTransfer.setData('sc-block',b.code));
      el.addEventListener('click',()=>insertCode(b.code));
      blockList.appendChild(el);
    });
  }

  palette.appendChild(catBar);palette.appendChild(blockList);
  showCat('motion');

  // ── COL 2: Script editor ───────────────────────────────────
  const editorCol=document.createElement('div');
  editorCol.style.cssText='flex:1;display:flex;flex-direction:column;min-width:0;';

  const editorTabs=document.createElement('div');
  editorTabs.style.cssText='background:#f0f0f0;border-bottom:1px solid #ddd;display:flex;align-items:center;padding:0 8px;height:32px;flex-shrink:0;gap:2px;';
  editorTabs.innerHTML=`<button class="sc-tab active" data-tab="code" style="background:#fff;border:1px solid #ccc;border-bottom:none;border-radius:4px 4px 0 0;padding:4px 12px;cursor:pointer;font-size:.78rem;font-weight:600;color:#333;">Código</button>
    <button class="sc-tab" data-tab="costumes" style="background:#f0f0f0;border:1px solid transparent;border-radius:4px 4px 0 0;padding:4px 12px;cursor:pointer;font-size:.78rem;color:#666;">Disfraces</button>
    <button class="sc-tab" data-tab="sounds" style="background:#f0f0f0;border:1px solid transparent;border-radius:4px 4px 0 0;padding:4px 12px;cursor:pointer;font-size:.78rem;color:#666;">Sonidos</button>
    <div style="flex:1;text-align:right;padding-right:4px;font-size:.7rem;color:#888;">Arrastra bloques aquí o escribe directamente</div>`;

  const editorContent=document.createElement('div');
  editorContent.style.cssText='flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative;';

  // Drop zone visual
  const dropHint=document.createElement('div');
  dropHint.style.cssText='position:absolute;inset:0;border:3px dashed #4C97FF;background:rgba(76,151,255,.06);pointer-events:none;opacity:0;transition:opacity .2s;z-index:5;display:flex;align-items:center;justify-content:center;';
  dropHint.innerHTML='<span style="color:#4C97FF;font-size:.9rem;font-weight:700;">Suelta el bloque aquí</span>';
  editorContent.appendChild(dropHint);

  const codeEditor=document.createElement('textarea');
  codeEditor.style.cssText='flex:1;width:100%;border:none;outline:none;font-family:Consolas,monospace;font-size:.85rem;line-height:1.7;padding:12px;background:#fff;resize:none;color:#1a1a1a;';
  codeEditor.placeholder='// Arrastra bloques desde la izquierda o escribe código aquí\n// Bloques disponibles:\n//   move(10) - mover pasos\n//   rotate(15) / rotateL(15) - girar\n//   goto(x,y) - ir a posición\n//   say("texto", segundos) - decir\n//   show() / hide() - mostrar/ocultar\n//   wait(segundos) - esperar\n//   repeat(n) ... end - repetir\n//   forever ... end - bucle infinito\n//\n// Ejemplo:\n// when_flag\n// move(50)\n// say("Hola mundo!", 2)\n// rotate(360)\n';
  if(fileId){const fi=findItemById(fileId);if(fi&&fi.content)codeEditor.value=fi.content;}
  editorContent.appendChild(codeEditor);

  // Console
  const consoleEl=document.createElement('div');
  consoleEl.style.cssText='height:80px;background:#111;color:#0f0;font-family:Consolas,monospace;font-size:.72rem;padding:6px 8px;overflow-y:auto;border-top:2px solid #333;flex-shrink:0;';
  consoleEl.innerHTML='<span style="color:#4C97FF;">Scratch 3.0</span> <span style="color:#666;">— Consola lista</span>';
  editorContent.appendChild(consoleEl);

  function logScratch(msg,color){const d=document.createElement('div');d.style.color=color||'#0f0';d.textContent=msg;consoleEl.appendChild(d);consoleEl.scrollTop=consoleEl.scrollHeight;}
  function insertCode(code){const pos=codeEditor.selectionStart;const val=codeEditor.value;const nl=val.length>0&&!val.endsWith('\n')?'\n':'';codeEditor.value=val+nl+code;codeEditor.focus();}

  // Drop handler
  editorContent.addEventListener('dragover',e=>{e.preventDefault();dropHint.style.opacity='1';});
  editorContent.addEventListener('dragleave',()=>dropHint.style.opacity='0');
  editorContent.addEventListener('drop',e=>{
    e.preventDefault();dropHint.style.opacity='0';
    const code=e.dataTransfer.getData('sc-block');
    if(code)insertCode(code);
  });

  editorCol.appendChild(editorTabs);editorCol.appendChild(editorContent);

  // ── COL 3: Stage + Sprites ────────────────────────────────
  const stageCol=document.createElement('div');
  stageCol.style.cssText='width:300px;background:#fff;border-left:2px solid #ddd;display:flex;flex-direction:column;flex-shrink:0;';

  // Stage canvas
  const stageCanvas=document.createElement('canvas');
  stageCanvas.width=300;stageCanvas.height=220;
  stageCanvas.style.cssText='display:block;background:#4D97FF;cursor:pointer;';
  const sCtx=stageCanvas.getContext('2d');

  // Stage controls
  const stageControls=document.createElement('div');
  stageControls.style.cssText='padding:6px 8px;background:#f9f9f9;border-top:1px solid #eee;flex-shrink:0;font-size:.72rem;';
  stageControls.innerHTML=`<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
    <span style="color:#555;">x: <b id="sc-x">0</b></span>
    <span style="color:#555;">y: <b id="sc-y">0</b></span>
    <span style="color:#555;">dir: <b id="sc-dir">90</b>°</span>
    <span style="color:#555;">tamaño: <b id="sc-sz">100</b>%</span>
  </div>`;

  // Sprite list
  const spriteList=document.createElement('div');
  spriteList.style.cssText='flex:1;padding:6px 8px;overflow-y:auto;border-top:1px solid #eee;';
  spriteList.innerHTML=`<div style="font-size:.72rem;font-weight:700;color:#555;margin-bottom:6px;">OBJETOS</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      <div style="width:72px;background:#e8f4ff;border:2px solid #4C97FF;border-radius:8px;padding:6px;text-align:center;cursor:pointer;">
        <canvas id="sc-sprite-thumb" width="56" height="56"></canvas>
        <div style="font-size:.68rem;color:#333;margin-top:2px;">Gato</div>
      </div>
    </div>`;

  stageCol.appendChild(stageCanvas);stageCol.appendChild(stageControls);stageCol.appendChild(spriteList);

  main.appendChild(palette);main.appendChild(editorCol);main.appendChild(stageCol);
  content.appendChild(menubar);content.appendChild(main);

  // ── DIBUJADO DEL SPRITE ───────────────────────────────────
  function drawCat(ctx2,cx,cy,size,dir,costIdx){
    const scale=size/100;
    ctx2.save();ctx2.translate(cx,cy);ctx2.rotate((dir-90)*Math.PI/180);ctx2.scale(scale,scale);
    // Cuerpo
    ctx2.fillStyle='#f5a623';ctx2.beginPath();ctx2.ellipse(0,4,14,16,0,0,Math.PI*2);ctx2.fill();
    // Cabeza
    ctx2.beginPath();ctx2.ellipse(0,-14,14,13,0,0,Math.PI*2);ctx2.fill();
    // Orejas
    ctx2.beginPath();ctx2.moveTo(-12,-22);ctx2.lineTo(-6,-30);ctx2.lineTo(-2,-20);ctx2.closePath();ctx2.fill();
    ctx2.beginPath();ctx2.moveTo(2,-20);ctx2.lineTo(6,-30);ctx2.lineTo(12,-22);ctx2.closePath();ctx2.fill();
    // Cara
    ctx2.fillStyle='#222';ctx2.beginPath();ctx2.arc(-5,-15,2.5,0,Math.PI*2);ctx2.fill();
    ctx2.beginPath();ctx2.arc(5,-15,2.5,0,Math.PI*2);ctx2.fill();
    // Nariz
    ctx2.fillStyle='#e86b3a';ctx2.beginPath();ctx2.arc(0,-11,2,0,Math.PI*2);ctx2.fill();
    // Bigotes
    ctx2.strokeStyle='#888';ctx2.lineWidth=0.8;
    [[-14,-12,-6,-11],[-14,-10,-6,-10],[6,-11,14,-12],[6,-10,14,-10]].forEach(([x1,y1,x2,y2])=>{ctx2.beginPath();ctx2.moveTo(x1,y1);ctx2.lineTo(x2,y2);ctx2.stroke();});
    // Cola
    ctx2.strokeStyle='#f5a623';ctx2.lineWidth=4;ctx2.lineCap='round';
    ctx2.beginPath();ctx2.moveTo(8,14);ctx2.bezierCurveTo(22,8,26,-4,18,-12);ctx2.stroke();
    ctx2.restore();
  }

  function updateStageInfo(){
    const xs=stageCol.querySelector('#sc-x'),ys=stageCol.querySelector('#sc-y');
    const ds=stageCol.querySelector('#sc-dir'),ss=stageCol.querySelector('#sc-sz');
    if(xs)xs.textContent=Math.round(sprite.x);
    if(ys)ys.textContent=Math.round(sprite.y);
    if(ds)ds.textContent=Math.round(sprite.dir);
    if(ss)ss.textContent=Math.round(sprite.size);
  }

  function renderStage(){
    sCtx.fillStyle='#e8f4ff';sCtx.fillRect(0,0,300,220);
    // Grid lines
    sCtx.strokeStyle='rgba(0,0,0,.06)';sCtx.lineWidth=1;
    for(let i=0;i<300;i+=30){sCtx.beginPath();sCtx.moveTo(i,0);sCtx.lineTo(i,220);sCtx.stroke();}
    for(let i=0;i<220;i+=22){sCtx.beginPath();sCtx.moveTo(0,i);sCtx.lineTo(300,i);sCtx.stroke();}
    // Center cross
    sCtx.strokeStyle='rgba(0,0,0,.15)';sCtx.lineWidth=1;
    sCtx.beginPath();sCtx.moveTo(150,0);sCtx.lineTo(150,220);sCtx.stroke();
    sCtx.beginPath();sCtx.moveTo(0,110);sCtx.lineTo(300,110);sCtx.stroke();
    if(sprite.visible){
      const sx=150+sprite.x*(150/240),sy=110-sprite.y*(110/180);
      drawCat(sCtx,sx,sy,sprite.size,sprite.dir,sprite.costume);
      if(sprite.saying){
        const bw=Math.max(80,sprite.saying.length*7+16);const bh=28;
        const bx=Math.min(270,sx+18);const by=Math.max(4,sy-44);
        sCtx.fillStyle='rgba(255,255,255,.97)';sCtx.strokeStyle='#aaa';sCtx.lineWidth=1.5;
        sCtx.beginPath();sCtx.roundRect(bx,by,bw,bh,5);sCtx.fill();sCtx.stroke();
        // Tail
        sCtx.beginPath();sCtx.moveTo(bx+8,by+bh);sCtx.lineTo(sx+4,sy-4);sCtx.lineTo(bx+18,by+bh);sCtx.closePath();sCtx.fillStyle='rgba(255,255,255,.97)';sCtx.fill();sCtx.stroke();
        sCtx.fillStyle='#222';sCtx.font='bold 11px Segoe UI';sCtx.textAlign='left';
        sCtx.fillText(sprite.saying,bx+8,by+18);
      }
    }
    // Thumb
    const thumb=document.getElementById('sc-sprite-thumb');
    if(thumb){const tc=thumb.getContext('2d');tc.clearRect(0,0,56,56);drawCat(tc,28,32,sprite.size/2,sprite.dir,sprite.costume);}
    updateStageInfo();
  }
  renderStage();

  // ── INTÉRPRETE ────────────────────────────────────────────
  async function runScript(){
    if(running)return;running=true;
    const code=codeEditor.value;
    const lines=code.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('//'));
    consoleEl.innerHTML='';logScratch('▶ Ejecutando...','#FFD700');
    try{await execLines(lines,0,lines.length);}
    catch(e){logScratch('Error: '+e.message,'#ff6b6b');}
    running=false;logScratch('■ Terminado.','#888');
  }

  async function execLines(lines,from,to){
    let i=from;
    while(i<to){
      if(!running)break;
      const line=lines[i];
      if(line==='forever'){
        const blockEnd=findEnd(lines,i+1);
        while(running){await execLines(lines,i+1,blockEnd);await sleep(16);}
        i=blockEnd+1;continue;
      }
      const repMatch=line.match(/^repeat\((\d+)\)$/);
      if(repMatch){
        const n=parseInt(repMatch[1]);const blockEnd=findEnd(lines,i+1);
        for(let r=0;r<n&&running;r++){await execLines(lines,i+1,blockEnd);await sleep(16);}
        i=blockEnd+1;continue;
      }
      const ifMatch=line.match(/^if\((.+)\)$/);
      if(ifMatch){
        const blockEnd=findEnd(lines,i+1);
        let cond=false;try{cond=!!eval(ifMatch[1]);}catch(e){}
        if(cond)await execLines(lines,i+1,blockEnd);
        i=blockEnd+1;continue;
      }
      if(line==='end'||line==='else'||line==='end_if'){i++;continue;}
      await execCmd(line);
      renderStage();i++;
    }
  }
  function findEnd(lines,from){let depth=0;for(let i=from;i<lines.length;i++){if(lines[i]==='repeat('||lines[i]==='forever'||lines[i].match(/^repeat\(/)||lines[i]==='forever'||lines[i].match(/^if\(/))depth++;if(lines[i]==='end'||lines[i]==='end_if'){if(depth===0)return i;depth--;}}return lines.length;}
  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
  async function execCmd(line){
    const m=(pat)=>line.match(pat);let r;
    if((r=m(/^move\((-?\d+\.?\d*)\)$/)))  {const s=+r[1],rad=(sprite.dir-90)*Math.PI/180;sprite.x+=s*Math.cos(rad);sprite.y+=s*Math.sin(rad);logScratch('move('+s+')');}
    else if((r=m(/^rotate\((-?\d+\.?\d*)\)$/)))  {sprite.dir=(sprite.dir+parseInt(r[1]))%360;logScratch('rotate('+r[1]+')');}
    else if((r=m(/^rotateL\((-?\d+\.?\d*)\)$/))) {sprite.dir=((sprite.dir-parseInt(r[1]))%360+360)%360;logScratch('rotateL('+r[1]+')');}
    else if((r=m(/^goto\((-?\d+\.?\d*),(-?\d+\.?\d*)\)$/))) {sprite.x=+r[1];sprite.y=+r[2];logScratch('goto('+r[1]+','+r[2]+')');}
    else if((r=m(/^direction\((-?\d+)\)$/)))      {sprite.dir=+r[1];}
    else if((r=m(/^changeX\((-?\d+\.?\d*)\)$/)))  {sprite.x+=+r[1];}
    else if((r=m(/^changeY\((-?\d+\.?\d*)\)$/)))  {sprite.y+=+r[1];}
    else if((r=m(/^setX\((-?\d+\.?\d*)\)$/)))     {sprite.x=+r[1];}
    else if((r=m(/^setY\((-?\d+\.?\d*)\)$/)))     {sprite.y=+r[1];}
    else if((r=m(/^say\("(.+?)"(?:,(\d+\.?\d*))?\)$/))) {
      sprite.saying=r[1];renderStage();
      if(r[2]){await sleep(+r[2]*1000);sprite.saying=null;}
      logScratch('say("'+r[1]+'")');
    }
    else if(line==='show()'){sprite.visible=true;logScratch('show()');}
    else if(line==='hide()'){sprite.visible=false;logScratch('hide()');}
    else if((r=m(/^resize\((-?\d+)\)$/)))   {sprite.size=Math.max(10,sprite.size+parseInt(r[1]));}
    else if((r=m(/^setSize\((\d+)\)$/)))    {sprite.size=Math.max(10,+r[1]);}
    else if((r=m(/^wait\((\d+\.?\d*)\)$/))) {await sleep(+r[1]*1000);logScratch('wait('+r[1]+'s)');}
    else if(line==='stop()'){running=false;logScratch('stop()','#f66');}
    else if(line==='nextCostume()'){sprite.costume=(sprite.costume+1)%2;}
    else if((r=m(/^setVar\("(.+?)",(.+)\)$/)))   {scratchVars[r[1]]=+r[2]||r[2];}
    else if((r=m(/^changeVar\("(.+?)",(-?\d+)\)$/))){scratchVars[r[1]]=(scratchVars[r[1]]||0)+parseInt(r[2]);}
    else if((r=m(/^when_flag$/)))   {/* handled as start */}
    else {logScratch('? '+line,'#888');}
    await sleep(50);
  }

  // ── BOTONES ───────────────────────────────────────────────
  menubar.querySelector('#sc-flag').addEventListener('click',()=>{if(running){running=false;return;}runScript();});
  menubar.querySelector('#sc-flag').addEventListener('mouseenter',function(){this.style.filter='brightness(1.2)';});
  menubar.querySelector('#sc-flag').addEventListener('mouseleave',function(){this.style.filter='';});
  menubar.querySelector('#sc-stop').addEventListener('click',()=>{running=false;sprite.saying=null;renderStage();logScratch('■ Detenido.','#e74c3c');});
  menubar.querySelector('#sc-new').addEventListener('click',()=>{if(confirm('¿Nuevo proyecto?')){codeEditor.value='';curFn='Sin título';menubar.querySelector('#sc-fname').textContent=curFn;sprite={x:0,y:0,dir:90,size:100,visible:true,saying:null,sayTimer:null,costume:0};scratchVars={};consoleEl.innerHTML='';renderStage();}});
  menubar.querySelector('#sc-save').addEventListener('click',()=>{
    const name=prompt('Nombre del proyecto:',curFn.replace('.scratch',''))||curFn;
    const fname=name.endsWith('.scratch')?name:name+'.scratch';
    const sf=findItemById('scratch-folder')||findItemById('desktop-folder');
    const ex=sf.children.find(c=>c.name===fname);
    const data=codeEditor.value;
    if(ex){ex.content=data;ex.dateModified=now();}
    else sf.children.push({id:uid(),type:'file',name:fname,ext:'scratch',content:data,hidden:false,dateModified:now(),size:data.length});
    curFn=fname;menubar.querySelector('#sc-fname').textContent=fname;saveState();logScratch('Guardado: '+fname,'#4C97FF');
    downloadFile(fname,data,'text/plain');
  });
  menubar.querySelector('#sc-load').addEventListener('click',()=>{
    const sf=findItemById('scratch-folder');if(!sf||!sf.children.length){alert('No hay proyectos guardados.');return;}
    const names=sf.children.map((c,i)=>(i+1)+'. '+c.name).join('\n');
    const sel=parseInt(prompt('Proyectos:\n'+names+'\n\nEscribe el número:'))-1;
    if(isNaN(sel)||sel<0||sel>=sf.children.length)return;
    codeEditor.value=sf.children[sel].content||'';curFn=sf.children[sel].name;menubar.querySelector('#sc-fname').textContent=curFn;logScratch('Abierto: '+curFn,'#4C97FF');
  });

  // Click en escenario mueve sprite
  stageCanvas.addEventListener('click',e=>{
    const r=stageCanvas.getBoundingClientRect();
    sprite.x=Math.round((e.clientX-r.left-150)/150*240);
    sprite.y=-Math.round((e.clientY-r.top-110)/110*180);
    renderStage();
  });

  // Animate stage loop
  let stageLoop;
  function animateStage(){
    if(!win.isConnected){return;}
    renderStage();stageLoop=requestAnimationFrame(animateStage);
  }
  animateStage();

  // Tab switching
  editorTabs.querySelectorAll('.sc-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      editorTabs.querySelectorAll('.sc-tab').forEach(t=>{t.style.background='#f0f0f0';t.style.border='1px solid transparent';t.style.color='#666';});
      tab.style.background='#fff';tab.style.border='1px solid #ccc';tab.style.borderBottom='none';tab.style.color='#333';
    });
  });
}

/* ============================================================
   MINECRAFT — Recreado completamente en canvas
   ============================================================ */
function openMinecraftLauncher(){
  const win=createWindow({title:'Minecraft Launcher',icon:'fa-solid fa-cube',width:720,height:520});
  const content=win.querySelector('.window-content');content.style.padding='0';

  const versions=[
    {id:'1.8.9',label:'1.8.9 - The Bountiful Update',type:'release'},
    {id:'1.8',label:'1.8',type:'release'},
    {id:'1.7.10',label:'1.7.10 - The Update that Changed the World',type:'release'},
    {id:'1.7.2',label:'1.7.2',type:'release'},
    {id:'1.6.4',label:'1.6.4 - Horse Update',type:'release'},
    {id:'1.5.2',label:'1.5.2 - Redstone Update',type:'release'},
    {id:'1.4.7',label:'1.4.7 - Pretty Scary Update',type:'release'},
    {id:'1.3.2',label:'1.3.2',type:'release'},
    {id:'1.2.5',label:'1.2.5 - Jungle Update',type:'release'},
    {id:'1.1',label:'1.1',type:'release'},
    {id:'1.0.0',label:'1.0.0 - Release',type:'release'},
    {id:'b1.8.1',label:'Beta 1.8.1 - Adventure Update',type:'beta'},
    {id:'b1.7.3',label:'Beta 1.7.3',type:'beta'},
    {id:'b1.6.6',label:'Beta 1.6.6',type:'beta'},
    {id:'b1.5_01',label:'Beta 1.5_01',type:'beta'},
    {id:'b1.4_01',label:'Beta 1.4_01',type:'beta'},
    {id:'b1.3_01',label:'Beta 1.3_01',type:'beta'},
    {id:'b1.2_02',label:'Beta 1.2_02',type:'beta'},
    {id:'b1.0.2',label:'Beta 1.0.2',type:'beta'},
    {id:'a1.2.6',label:'Alpha 1.2.6',type:'alpha'},
    {id:'a1.2.5',label:'Alpha 1.2.5',type:'alpha'},
    {id:'a1.1.2_01',label:'Alpha 1.1.2_01',type:'alpha'},
    {id:'a1.0.17',label:'Alpha 1.0.17',type:'alpha'},
    {id:'a1.0.4',label:'Alpha 1.0.4',type:'alpha'},
    {id:'inf-20100618',label:'Indev 20100618',type:'old'},
    {id:'c0.30_01c',label:'Classic 0.30_01c',type:'old'},
    {id:'c0.0.23a',label:'Classic 0.0.23a',type:'old'},
  ];

  const cont=document.createElement('div');
  cont.style.cssText='display:flex;height:100%;';

  // Sidebar
  const sb=document.createElement('div');
  sb.style.cssText='width:180px;background:#0d0d0d;border-right:1px solid #222;display:flex;flex-direction:column;flex-shrink:0;';
  sb.innerHTML=`<div style="background:#1a2a1a;padding:14px 10px;border-bottom:1px solid #222;text-align:center;">
    <div style="font-size:2.8rem;margin-bottom:6px;">⛏️</div>
    <div style="color:#5b9f28;font-weight:900;font-size:.95rem;letter-spacing:.05em;">MINECRAFT</div>
    <div style="color:#666;font-size:.68rem;">Java Edition (Web)</div>
  </div>
  <nav style="flex:1;padding:8px 0;">
    <div class="mc-nav" data-p="play"     style="padding:10px 14px;cursor:pointer;color:#ccc;font-size:.82rem;border-left:3px solid #5b9f28;background:rgba(255,255,255,.04);display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-play" style="color:#5b9f28;font-size:.75rem;"></i> Jugar</div>
    <div class="mc-nav" data-p="installs" style="padding:10px 14px;cursor:pointer;color:#888;font-size:.82rem;border-left:3px solid transparent;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-list" style="font-size:.75rem;"></i> Instalaciones</div>
  </nav>
  <div style="padding:8px;border-top:1px solid #222;color:#444;font-size:.65rem;">Launcher v3.0</div>`;

  const mainArea=document.createElement('div');
  mainArea.style.cssText='flex:1;display:flex;flex-direction:column;overflow:hidden;';

  // ── TAB PLAY ────────────────────────────────────────────────
  const tabPlay=document.createElement('div');tabPlay.dataset.p='play';tabPlay.style.cssText='display:flex;flex-direction:column;height:100%;';
  const hero=document.createElement('div');
  hero.style.cssText='flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;position:relative;overflow:hidden;cursor:pointer;';
  // Minecraft-style panorama background
  hero.innerHTML=`
    <canvas id="mc-panorama" style="position:absolute;inset:0;width:100%;height:100%;"></canvas>
    <div style="position:relative;text-align:center;z-index:1;">
      <div style="font-size:3.5rem;filter:drop-shadow(3px 3px 12px rgba(0,0,0,.9));">⛏️</div>
      <div style="color:#fff;font-size:2.4rem;font-weight:900;text-shadow:3px 3px 0 #000,2px 2px 0 #555;letter-spacing:.05em;font-family:'Segoe UI',monospace;">MINECRAFT</div>
      <div style="color:#5b9f28;font-size:.85rem;font-weight:700;letter-spacing:.12em;text-shadow:1px 1px 3px rgba(0,0,0,.8);">JAVA EDITION</div>
    </div>`;
  const form=document.createElement('div');
  form.style.cssText='background:#1a1a1a;padding:14px;border-top:1px solid #222;flex-shrink:0;';
  const verOpts=versions.map(v=>`<option value="${v.id}">${v.label}${v.type!=='release'?' ['+v.type.toUpperCase()+']':''}</option>`).join('');
  form.innerHTML=`<div style="display:flex;gap:10px;align-items:flex-end;margin-bottom:10px;">
    <div style="flex:1;"><label style="color:#aaa;font-size:.7rem;display:block;margin-bottom:4px;font-weight:700;">NOMBRE DEL JUGADOR</label>
      <input id="mc-uname" value="${sysConfig.username}" maxlength="16" style="width:100%;background:#0d0d0d;color:#fff;border:1px solid #444;border-radius:4px;padding:8px 10px;font-size:.88rem;outline:none;font-family:inherit;"></div>
    <div style="flex:1;"><label style="color:#aaa;font-size:.7rem;display:block;margin-bottom:4px;font-weight:700;">VERSIÓN</label>
      <select id="mc-ver" style="width:100%;background:#0d0d0d;color:#fff;border:1px solid #444;border-radius:4px;padding:8px 10px;font-size:.8rem;outline:none;">${verOpts}</select></div>
    <button id="mc-play-btn" style="background:#5b9f28;color:#fff;border:none;border-radius:6px;padding:10px 26px;font-size:1rem;font-weight:900;cursor:pointer;white-space:nowrap;border-bottom:3px solid #3d6e1c;transition:all .1s;">▶ JUGAR</button>
  </div>
  <div id="mc-log" style="background:#000;color:#0f0;font-family:Consolas,monospace;font-size:.72rem;padding:6px;height:58px;overflow-y:auto;border-radius:4px;display:none;border:1px solid #222;"></div>`;
  tabPlay.appendChild(hero);tabPlay.appendChild(form);

  // ── Panorama animado ─────────────────────────────────────────
  setTimeout(()=>{
    const pc=document.getElementById('mc-panorama');if(!pc)return;
    const px=pc.getContext('2d');let t=0;
    function drawPanorama(){
      if(!win.isConnected)return;
      px.clearRect(0,0,pc.width,pc.height);
      // Sky
      const sky=px.createLinearGradient(0,0,0,pc.height*0.6);
      sky.addColorStop(0,'#1a6aa8');sky.addColorStop(1,'#3d9ad8');
      px.fillStyle=sky;px.fillRect(0,0,pc.width,pc.height*0.6);
      // Ground
      const gnd=px.createLinearGradient(0,pc.height*0.6,0,pc.height);
      gnd.addColorStop(0,'#4a7c2c');gnd.addColorStop(0.1,'#5b9f28');gnd.addColorStop(0.15,'#8B5E3C');gnd.addColorStop(1,'#5a3a1a');
      px.fillStyle=gnd;px.fillRect(0,pc.height*0.6,pc.width,pc.height*0.4);
      // Blocks in distance
      const BSIZE=12;
      const blockColors=['#4a7c2c','#5b9f28','#8B5E3C','#555','#4a4a4a','#777','#3d6e1c'];
      const offX=(t*0.3)%BSIZE;
      for(let bx=(-offX|0)-BSIZE;bx<pc.width+BSIZE;bx+=BSIZE){
        for(let by=0;by<3;by++){
          const h=Math.sin(bx*0.15+by*0.8)*2;
          const y=pc.height*0.55+(by*BSIZE)-h;
          const color=blockColors[Math.abs(Math.floor((bx+by*7)/BSIZE))%blockColors.length];
          px.fillStyle=color;px.fillRect(bx,y,BSIZE-1,BSIZE-1);
          px.fillStyle='rgba(0,0,0,.2)';px.fillRect(bx,y,BSIZE-1,2);px.fillRect(bx+BSIZE-2,y,2,BSIZE-1);
        }
      }
      // Sun
      const sunX=50+Math.cos(t*0.005)*30;const sunY=20+Math.sin(t*0.005)*10;
      px.fillStyle='#FFE87C';px.fillRect(sunX-8,sunY-8,16,16);
      px.fillStyle='#FFD700';px.fillRect(sunX-6,sunY-6,12,12);
      // Clouds
      [[100,15],[200,25],[320,12]].forEach(([cx,cy],i)=>{
        const cloudX=(cx-t*0.08+pc.width)%pc.width;
        px.fillStyle='rgba(255,255,255,.9)';
        [[0,0,32,12],[10,-8,24,12],[20,0,28,12]].forEach(([ox,oy,w,h])=>{px.fillRect(cloudX+ox,cy+oy,w,h);});
      });
      t++;requestAnimationFrame(drawPanorama);
    }
    drawPanorama();
  },100);

  // ── TAB INSTALLS ──────────────────────────────────────────────
  const tabInstall=document.createElement('div');tabInstall.dataset.p='installs';tabInstall.style.cssText='display:none;padding:14px;color:#ccc;flex:1;overflow-y:auto;background:#111;';
  tabInstall.innerHTML=`<h3 style="font-size:.9rem;margin-bottom:10px;color:#fff;border-bottom:1px solid #333;padding-bottom:6px;">Perfiles de instalación</h3>
    <div id="mc-profiles"></div>
    <button id="mc-add-prof" style="margin-top:10px;background:#5b9f28;color:#fff;border:none;border-radius:4px;padding:7px 14px;cursor:pointer;font-size:.8rem;border-bottom:2px solid #3d6e1c;">+ Nuevo perfil</button>`;

  mainArea.appendChild(tabPlay);mainArea.appendChild(tabInstall);
  cont.appendChild(sb);cont.appendChild(mainArea);content.appendChild(cont);

  // Nav
  sb.querySelectorAll('.mc-nav').forEach(item=>{
    item.addEventListener('click',()=>{
      sb.querySelectorAll('.mc-nav').forEach(n=>{n.style.color='#888';n.style.borderLeftColor='transparent';n.style.background='transparent';});
      item.style.color='#ccc';item.style.borderLeftColor='#5b9f28';item.style.background='rgba(255,255,255,.04)';
      mainArea.querySelectorAll('[data-p]').forEach(p=>p.style.display='none');
      const panel=mainArea.querySelector(`[data-p="${item.dataset.p}"]`);
      if(panel)panel.style.display='flex';
      if(item.dataset.p==='installs')renderProfiles();
    });
  });

  let mcProfiles=JSON.parse(localStorage.getItem('mc-profiles')||'[]');
  if(!mcProfiles.length)mcProfiles=[{name:'Perfil por defecto',version:'1.8.9'}];
  function renderProfiles(){
    const pl=tabInstall.querySelector('#mc-profiles');if(!pl)return;pl.innerHTML='';
    mcProfiles.forEach((p,i)=>{
      const r=document.createElement('div');r.style.cssText='display:flex;align-items:center;gap:8px;padding:8px;background:#1a1a1a;border-radius:4px;margin-bottom:6px;border:1px solid #2a2a2a;';
      r.innerHTML=`<div style="width:36px;height:36px;background:#2a3a2a;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;">⛏️</div>
        <div style="flex:1;"><div style="color:#fff;font-size:.85rem;font-weight:600;">${p.name}</div><div style="color:#666;font-size:.72rem;">${p.version}</div></div>
        <button data-i="${i}" style="background:#c0392b;color:#fff;border:none;border-radius:3px;padding:3px 8px;cursor:pointer;font-size:.72rem;">×</button>`;
      r.querySelector('button').addEventListener('click',()=>{mcProfiles.splice(i,1);localStorage.setItem('mc-profiles',JSON.stringify(mcProfiles));renderProfiles();});
      pl.appendChild(r);
    });
  }
  tabInstall.querySelector('#mc-add-prof').addEventListener('click',()=>{
    const n=prompt('Nombre del perfil:');const v=prompt('Versión:','1.8.9');
    if(n&&v){mcProfiles.push({name:n,version:v});localStorage.setItem('mc-profiles',JSON.stringify(mcProfiles));renderProfiles();}
  });

  let launching=false;
  const playBtn=cont.querySelector('#mc-play-btn');
  const logDiv=cont.querySelector('#mc-log');
  playBtn.addEventListener('mouseenter',()=>{playBtn.style.background='#4a8520';playBtn.style.borderBottomColor='#2d5211';});
  playBtn.addEventListener('mouseleave',()=>{playBtn.style.background='#5b9f28';playBtn.style.borderBottomColor='#3d6e1c';});
  playBtn.addEventListener('mousedown',()=>{playBtn.style.transform='translateY(2px)';playBtn.style.borderBottomWidth='1px';});
  playBtn.addEventListener('mouseup',()=>{playBtn.style.transform='';playBtn.style.borderBottomWidth='3px';});

  playBtn.addEventListener('click',()=>{
    if(launching)return;
    const uname=cont.querySelector('#mc-uname').value.trim();
    const ver=cont.querySelector('#mc-ver').value;
    if(!uname){alert('Ingresa un nombre de jugador.');return;}
    if(uname.includes(' ')){alert('El nombre no puede tener espacios.');return;}
    sysConfig.username=uname;saveState();
    const su=document.getElementById('start-username');if(su)su.textContent=uname;
    launching=true;logDiv.style.display='block';logDiv.innerHTML='';
    playBtn.textContent='Cargando...';playBtn.disabled=true;
    const vobj=versions.find(v=>v.id===ver)||{label:ver,type:'release'};
    const logs=[
      `[${new Date().toLocaleTimeString()}] [main/INFO]: Minecraft Launcher v3.0`,
      `[${new Date().toLocaleTimeString()}] [main/INFO]: Bienvenido, ${uname}!`,
      `[${new Date().toLocaleTimeString()}] [Client/INFO]: Cargando versión ${vobj.label}...`,
      `[${new Date().toLocaleTimeString()}] [Client/INFO]: Inicializando motor de juego...`,
      `[${new Date().toLocaleTimeString()}] [Client/INFO]: Generando mundo (seed: ${Math.floor(Math.random()*999999)})...`,
      `[${new Date().toLocaleTimeString()}] [Client/INFO]: Cargando chunks...`,
      `[${new Date().toLocaleTimeString()}] [Client/INFO]: ¡Listo! Abriendo mundo...`,
    ];
    let li=0;
    const pLog=()=>{
      if(li>=logs.length){
        launching=false;playBtn.textContent='▶ JUGAR';playBtn.disabled=false;
        // Abrir el juego de Minecraft recreado
        openMinecraftGame(uname,ver,win);
        return;
      }
      const d=document.createElement('div');d.textContent=logs[li++];d.style.color='#0f0';
      logDiv.appendChild(d);logDiv.scrollTop=logDiv.scrollHeight;
      setTimeout(pLog,420);
    };pLog();
  });
  renderProfiles();
}

function openMinecraftGame(username,version,launcherWin){
  // Abrir ventana de juego Minecraft recreado en canvas
  launcherWin.querySelector('.close-btn').click();
  const win=createWindow({title:'Minecraft '+version+' - '+username,icon:'fa-solid fa-cube',width:900,height:560});
  win.style.left='0';win.style.top='0';
  const content=win.querySelector('.window-content');content.style.padding='0';

  const wrap=document.createElement('div');wrap.style.cssText='position:relative;width:100%;height:100%;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;';
  const canvas=document.createElement('canvas');
  canvas.style.cssText='display:block;image-rendering:pixelated;';
  const hud=document.createElement('div');hud.style.cssText='position:absolute;top:0;left:0;right:0;background:rgba(0,0,0,.7);padding:4px 10px;display:flex;gap:12px;align-items:center;font-family:Consolas,monospace;font-size:.75rem;color:#fff;z-index:10;pointer-events:none;';
  hud.innerHTML=`<span>👤 ${username}</span><span id="mc-coords">X:0 Y:64 Z:0</span><span id="mc-time">Día 1</span><span style="margin-left:auto;opacity:.6;">WASD=mover  ESPACIO=saltar  F=destellar  Q=quit</span>`;
  wrap.appendChild(hud);wrap.appendChild(canvas);content.appendChild(wrap);

  // Resize canvas to fit window
  function resizeCanvas(){canvas.width=wrap.clientWidth||800;canvas.height=(wrap.clientHeight||520)-28;draw();}
  setTimeout(resizeCanvas,50);

  const ctx=canvas.getContext('2d');

  // ── MUNDO MINECRAFT SIMPLIFICADO ──────────────────────────
  const TILE=24;
  const WORLD_W=64,WORLD_H=32;
  // Tipos de bloque
  const AIR=0,GRASS=1,DIRT=2,STONE=3,WATER=4,WOOD=5,LEAVES=6,SAND=7,BEDROCK=8,COAL=9,IRON=10,GOLD=11,DIAMOND=12,CHEST=13,CRAFTING=14,GLASS=15;
  const BLOCK_COLORS={
    [GRASS]:['#5b9f28','#4a7c1e','#3d6e1c'],
    [DIRT]: ['#8B5E3C','#7a5230','#6b4528'],
    [STONE]:['#888','#777','#666'],
    [WATER]:['rgba(64,120,200,.7)','rgba(50,100,180,.7)','rgba(40,90,160,.7)'],
    [WOOD]: ['#8B6914','#7a5c10','#6a4e0e'],
    [LEAVES]:['#2d7a1e','#256618','#1e5212'],
    [SAND]: ['#e0c98a','#d4bc78','#c8b066'],
    [BEDROCK]:['#333','#2a2a2a','#222'],
    [COAL]: ['#444','#555','#333'],
    [IRON]: ['#c8a87a','#b89668','#a88456'],
    [GOLD]: ['#FFD700','#f0c800','#e0b800'],
    [DIAMOND]:['#00e5ff','#00cfee','#00bfdd'],
    [CHEST]:['#8B4513','#ffa500','#8B4513'],
    [CRAFTING]:['#8B5E3C','#888','#8B5E3C'],
    [GLASS]:['rgba(200,230,255,.3)','rgba(180,210,235,.3)','rgba(160,190,215,.3)'],
  };
  const BLOCK_NAMES={[AIR]:'Aire',[GRASS]:'Hierba',[DIRT]:'Tierra',[STONE]:'Piedra',[WATER]:'Agua',[WOOD]:'Madera',[LEAVES]:'Hojas',[SAND]:'Arena',[BEDROCK]:'Piedra Base',[COAL]:'Carbón',[IRON]:'Hierro',[GOLD]:'Oro',[DIAMOND]:'Diamante',[CHEST]:'Cofre',[CRAFTING]:'Mesa de Trabajo',[GLASS]:'Vidrio'};

  // Generar mundo procedural
  const world=Array.from({length:WORLD_H},(_,y)=>Array.from({length:WORLD_W},(_,x)=>{
    if(y===WORLD_H-1)return BEDROCK;
    const h=Math.floor(WORLD_H*0.55+Math.sin(x*0.3)*3+Math.cos(x*0.17)*2+Math.sin(x*0.07)*4);
    if(y<h)return AIR;
    if(y===h)return Math.random()<0.15?SAND:GRASS;
    if(y===h+1||y===h+2)return DIRT;
    if(y>h+2){
      const d=y-h;
      if(d>12&&Math.random()<0.04)return DIAMOND;
      if(d>8&&Math.random()<0.06)return GOLD;
      if(d>4&&Math.random()<0.08)return IRON;
      if(Math.random()<0.1)return COAL;
      return STONE;
    }
    return AIR;
  }));

  // Añadir árboles
  for(let tx=3;tx<WORLD_W-3;tx+=6+Math.floor(Math.random()*4)){
    let groundY=0;for(let y=0;y<WORLD_H;y++){if(world[y][tx]===GRASS){groundY=y;break;}}
    if(groundY>0&&groundY<WORLD_H-6){
      for(let h=1;h<=4;h++)if(world[groundY-h])world[groundY-h][tx]=WOOD;
      for(let lx=-2;lx<=2;lx++)for(let ly=-3;ly<=-1;ly++){
        const ny=groundY+ly,nx=tx+lx;
        if(ny>=0&&ny<WORLD_H&&nx>=0&&nx<WORLD_W&&world[ny][nx]===AIR)world[ny][nx]=LEAVES;
      }
    }
  }
  // Añadir agua en valles
  for(let x=0;x<WORLD_W;x++){
    const groundH=Math.floor(WORLD_H*0.55+Math.sin(x*0.3)*3+Math.cos(x*0.17)*2+Math.sin(x*0.07)*4);
    if(groundH>WORLD_H*0.6){for(let y=groundH;y<WORLD_H*0.62;y++)if(world[y]&&world[y][x]===AIR)world[y][x]=WATER;}
  }

  // Jugador
  let px=8,py=0,pdx=0,pdy=0,onGround=false,jumping=false;
  let camX=0,camY=0;
  // Posicionar jugador en superficie
  for(let y=0;y<WORLD_H;y++){if(world[y]&&world[y][Math.floor(px)]!==AIR&&world[y][Math.floor(px)]!==WATER){py=y-2;break;}}

  let gameTime=0,dayTime=0;
  let inventory=[{block:DIRT,count:20},{block:STONE,count:15},{block:WOOD,count:10},{block:GLASS,count:8},{block:CHEST,count:3}];
  let hotbarSel=0;
  let placing=false,breaking=false,breakTarget={x:-1,y:-1},breakProg=0;
  let particleList=[];
  const keys={};

  // Movimiento del jugador
  function getPlayerBlock(ox,oy){const bx=Math.floor(px+ox),by=Math.floor(py+oy);if(bx<0||bx>=WORLD_W||by<0||by>=WORLD_H)return AIR;return world[by][bx]||AIR;}
  function isSolid(b){return b!==AIR&&b!==WATER&&b!==LEAVES;}

  function updatePlayer(){
    const speed=0.12,gravity=0.04,jumpPow=0.55;
    if(keys['a']||keys['ArrowLeft']) pdx-=speed;
    if(keys['d']||keys['ArrowRight'])pdx+=speed;
    if((keys[' ']||keys['w']||keys['ArrowUp'])&&onGround){pdy=-jumpPow;onGround=false;}
    pdx*=0.75;pdy+=gravity;if(pdy>0.8)pdy=0.8;
    // X collision
    if(!isSolid(getPlayerBlock(pdx>0?0.5:-0.5,0))&&!isSolid(getPlayerBlock(pdx>0?0.5:-0.5,-0.9))){px+=pdx;}else{pdx=0;}
    // Y collision
    onGround=false;
    if(pdy>0){if(!isSolid(getPlayerBlock(0,pdy))&&!isSolid(getPlayerBlock(0.4,pdy))){py+=pdy;}else{py=Math.floor(py+pdy);pdy=0;onGround=true;}}
    else{if(!isSolid(getPlayerBlock(0,pdy-0.9))){py+=pdy;}else{py=Math.floor(py)+0.1;pdy=0;}}
    px=Math.max(0.5,Math.min(WORLD_W-1.5,px));
    // Camera
    camX=px-canvas.width/2/TILE;camY=py-canvas.height/2/TILE;
    camX=Math.max(0,Math.min(WORLD_W-canvas.width/TILE,camX));
    camY=Math.max(0,Math.min(WORLD_H-canvas.height/TILE,camY));
    gameTime++;dayTime=(gameTime%2400)/2400;
    document.getElementById('mc-coords').textContent=`X:${Math.floor(px)} Y:${Math.floor(WORLD_H-py)} Z:0`;
    document.getElementById('mc-time').textContent=`Día ${1+Math.floor(gameTime/2400)}`;
  }

  function addParticle(x,y,color){
    for(let i=0;i<6;i++)particleList.push({x:x*TILE,y:y*TILE,vx:(Math.random()-.5)*3,vy:-(Math.random()*3+1),life:30,color});
  }

  function draw(){
    if(!win.isConnected)return;
    const W=canvas.width,H=canvas.height;
    // Sky gradient based on time
    const dawnColors=[['#1a1a3a','#2a2a5a'],['#ff7043','#ffb74d'],['#64b5f6','#87ceeb'],['#87ceeb','#b3e5fc'],['#64b5f6','#87ceeb'],['#ff7043','#e64a19'],['#1a1a3a','#111']];
    const seg=Math.floor(dayTime*7),blend=dayTime*7-seg;
    const s=dawnColors[Math.min(seg,6)],e=dawnColors[Math.min(seg+1,6)];
    function lerpC(c1,c2,t){return c1.startsWith('#')?c1:c1;}
    const sky=ctx.createLinearGradient(0,0,0,H*0.7);
    sky.addColorStop(0,s[0]);sky.addColorStop(1,s[1]);
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    // Sun / Moon
    const sunAngle=(dayTime-0.25)*Math.PI*2;const sunX=W/2+Math.cos(sunAngle)*(W*0.45),sunY=H*0.35-Math.sin(sunAngle)*(H*0.4);
    ctx.fillStyle=dayTime>0.2&&dayTime<0.8?'#FFE87C':'#EEE';ctx.fillRect(sunX-8,sunY-8,16,16);
    // Stars at night
    if(dayTime<0.2||dayTime>0.8){
      ctx.fillStyle=`rgba(255,255,255,${dayTime<0.2?1-dayTime*5:dayTime*5-4})`;
      for(let s2=0;s2<40;s2++){const sx=((s2*97+13)%W),sy=((s2*53+7)%(H*0.5));ctx.fillRect(sx,sy,1,1);}
    }
    // Clouds
    ctx.fillStyle='rgba(255,255,255,.85)';
    for(let ci=0;ci<4;ci++){
      const cx=((ci*130+gameTime*0.1)%W+W)%W,cy=30+ci*12;
      [[0,0,40,14],[10,-8,30,14],[20,0,36,14]].forEach(([ox,oy,w,h2])=>{ctx.fillRect(cx+ox,cy+oy,w,h2);});
    }
    // Render blocks
    const startX=Math.max(0,Math.floor(camX));const endX=Math.min(WORLD_W,Math.ceil(camX+W/TILE+1));
    const startY=Math.max(0,Math.floor(camY));const endY=Math.min(WORLD_H,Math.ceil(camY+H/TILE+1));
    for(let by=startY;by<endY;by++){
      for(let bx=startX;bx<endX;bx++){
        const block=world[by][bx];if(block===AIR)continue;
        const sx=(bx-camX)*TILE,sy=(by-camY)*TILE;
        const cols=BLOCK_COLORS[block]||['#888','#777','#666'];
        ctx.fillStyle=cols[0];ctx.fillRect(sx,sy,TILE,TILE);
        // Top shade
        ctx.fillStyle=cols[1];ctx.fillRect(sx,sy,TILE,2);
        ctx.fillStyle=cols[2];ctx.fillRect(sx,sy,2,TILE);
        // Grid
        ctx.strokeStyle='rgba(0,0,0,.15)';ctx.lineWidth=0.5;ctx.strokeRect(sx+.5,sy+.5,TILE-1,TILE-1);
        // Breaking overlay
        if(bx===breakTarget.x&&by===breakTarget.y&&breakProg>0){
          ctx.fillStyle=`rgba(0,0,0,${breakProg/5})`;ctx.fillRect(sx,sy,TILE,TILE);
          const cracks=['','╲','╲╱','╲╳╱','╲╳╱╲'];ctx.fillStyle='rgba(0,0,0,.5)';ctx.font=`${TILE*0.6}px serif`;ctx.textAlign='center';ctx.fillText(cracks[Math.floor(breakProg)]||'',sx+TILE/2,sy+TILE*0.7);
        }
        // Block texture details
        if(block===GRASS){ctx.fillStyle='rgba(0,0,0,.1)';for(let i=0;i<4;i++)ctx.fillRect(sx+3+i*5,sy+3,1,2);}
        if(block===LEAVES){ctx.fillStyle='rgba(0,100,0,.2)';for(let i=0;i<3;i++){ctx.fillRect(sx+4+i*6,sy+4,3,3);ctx.fillRect(sx+2+i*6,sy+10,3,3);}}
        if(block===WOOD){ctx.fillStyle='rgba(0,0,0,.1)';ctx.fillRect(sx+TILE*0.4,sy,TILE*0.2,TILE);}
        if(block===CHEST){ctx.fillStyle='#ffa500';ctx.fillRect(sx+3,sy+6,TILE-6,5);ctx.fillStyle='#8B4513';ctx.fillRect(sx+TILE/2-2,sy+7,4,3);}
        if(block===DIAMOND){ctx.fillStyle='rgba(0,255,255,.5)';ctx.beginPath();ctx.arc(sx+TILE/2,sy+TILE/2,5,0,Math.PI*2);ctx.fill();}
        if(block===GOLD){ctx.fillStyle='rgba(255,220,0,.5)';ctx.beginPath();ctx.arc(sx+TILE/2,sy+TILE/2,5,0,Math.PI*2);ctx.fill();}
      }
    }
    // Particles
    particleList=particleList.filter(p=>{
      p.x+=p.vx;p.y+=p.vy;p.vy+=0.15;p.life--;
      ctx.fillStyle=p.color;ctx.globalAlpha=p.life/30;ctx.fillRect(p.x,p.y,4,4);ctx.globalAlpha=1;
      return p.life>0;
    });
    // Player
    const plsx=(px-camX)*TILE,plsy=(py-camY)*TILE;
    // Body
    ctx.fillStyle='#5599ff';ctx.fillRect(plsx-6,plsy,12,14);
    // Head
    ctx.fillStyle='#ffc88a';ctx.fillRect(plsx-6,plsy-12,12,12);
    // Eyes
    ctx.fillStyle='#222';ctx.fillRect(plsx-3,plsy-8,3,2);ctx.fillRect(plsx+1,plsy-8,3,2);
    // Legs - animated
    const legOff=onGround?Math.sin(gameTime*0.2)*(Math.abs(pdx)>0.01?1:0):0;
    ctx.fillStyle='#3a3a8a';ctx.fillRect(plsx-6,plsy+14,5,onGround?10+legOff*2:10);
    ctx.fillRect(plsx+2,plsy+14,5,onGround?10-legOff*2:10);
    // Arms - animated
    ctx.fillStyle='#5599ff';ctx.fillRect(plsx-10,plsy+(onGround?legOff*2:0),4,10);
    ctx.fillRect(plsx+6,plsy+(onGround?-legOff*2:0),4,10);
    // Name tag
    ctx.fillStyle='rgba(0,0,0,.5)';const nameW=ctx.measureText(username).width+8;ctx.fillRect(plsx-nameW/2,plsy-22,nameW,12);
    ctx.fillStyle='#fff';ctx.font='9px Segoe UI';ctx.textAlign='center';ctx.fillText(username,plsx,plsy-13);
    // Hotbar
    const hbW=9*36+8,hbX=(W-hbW)/2,hbY=H-42;
    ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(hbX-2,hbY-2,hbW+4,36);
    inventory.slice(0,9).forEach((slot,i)=>{
      const bx2=hbX+i*36+i,by2=hbY;
      ctx.fillStyle=i===hotbarSel?'rgba(255,255,255,.3)':'rgba(255,255,255,.1)';
      ctx.fillRect(bx2,by2,34,32);
      if(i===hotbarSel){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(bx2,by2,34,32);}
      const bc=BLOCK_COLORS[slot.block]||['#888'];ctx.fillStyle=bc[0];ctx.fillRect(bx2+5,by2+4,24,24);
      ctx.fillStyle='#fff';ctx.font='9px monospace';ctx.textAlign='right';ctx.fillText(slot.count,bx2+30,by2+30);
    });
    // Crosshair
    ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(W/2-8,H/2);ctx.lineTo(W/2+8,H/2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(W/2,H/2-8);ctx.lineTo(W/2,H/2+8);ctx.stroke();
    // Selected block info
    const selBlock=inventory[hotbarSel];
    if(selBlock){ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(W/2-50,H-70,100,18);ctx.fillStyle='#fff';ctx.font='10px Segoe UI';ctx.textAlign='center';ctx.fillText(BLOCK_NAMES[selBlock.block]||'Bloque',W/2,H-58);}
    // Daylight overlay
    if(dayTime<0.15||dayTime>0.85){ctx.fillStyle=`rgba(0,0,20,${dayTime<0.15?0.7-dayTime*4:dayTime*4-3.4})`;ctx.fillRect(0,0,W,H);}
    // Hearts
    ctx.font='14px serif';ctx.textAlign='left';for(let h2=0;h2<5;h2++)ctx.fillText('❤️',hbX+h2*18,H-50);
    // Hunger
    ctx.textAlign='right';for(let f=0;f<5;f++)ctx.fillText('🍗',hbX+hbW-f*18,H-50);
  }

  // Mouse: place/break blocks
  canvas.addEventListener('mousedown',e=>{
    const rect=canvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left)/TILE+camX,my=(e.clientY-rect.top)/TILE+camY;
    const bx=Math.floor(mx),by=Math.floor(my);
    if(e.button===2){
      // Place block
      const selBlock=inventory[hotbarSel];
      if(selBlock&&selBlock.count>0&&bx>=0&&bx<WORLD_W&&by>=0&&by<WORLD_H&&world[by][bx]===AIR){
        world[by][bx]=selBlock.block;selBlock.count--;if(selBlock.count<=0)inventory.splice(hotbarSel,1);
        addParticle(bx,by,BLOCK_COLORS[selBlock.block][0]);
      }
    } else {
      breakTarget={x:bx,y:by};breakProg=0;breaking=true;
    }
  });
  canvas.addEventListener('mouseup',()=>{breaking=false;breakProg=0;breakTarget={x:-1,y:-1};});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('mousemove',e=>{
    if(!breaking)return;
    const rect=canvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left)/TILE+camX,my=(e.clientY-rect.top)/TILE+camY;
    const bx=Math.floor(mx),by=Math.floor(my);
    if(bx!==breakTarget.x||by!==breakTarget.y){breakTarget={x:bx,y:by};breakProg=0;}
  });

  // Keyboard
  const onKeyDown=e=>{if(!win.isConnected){document.removeEventListener('keydown',onKeyDown);return;}keys[e.key]=true;
    if(e.key==='q'||e.key==='Q'){win.querySelector('.close-btn').click();}
    const numKeys=['1','2','3','4','5','6','7','8','9'];const ni=numKeys.indexOf(e.key);if(ni>=0)hotbarSel=ni;
    if(e.key==='f'||e.key==='F'){sCtx&&(sCtx.fillStyle='rgba(255,255,255,.2)');}
  };
  const onKeyUp=e=>{keys[e.key]=false;};
  document.addEventListener('keydown',onKeyDown);document.addEventListener('keyup',onKeyUp);

  // Game loop
  function gameLoop(){
    if(!win.isConnected){document.removeEventListener('keydown',onKeyDown);document.removeEventListener('keyup',onKeyUp);return;}
    updatePlayer();
    if(breaking&&breakTarget.x>=0){
      breakProg+=0.08;
      if(breakProg>=5){
        const b=world[breakTarget.y][breakTarget.x];
        if(b!==AIR&&b!==BEDROCK){
          addParticle(breakTarget.x,breakTarget.y,BLOCK_COLORS[b][0]);
          world[breakTarget.y][breakTarget.x]=AIR;
          const ex=inventory.find(s=>s.block===b);
          if(ex)ex.count++;else inventory.push({block:b,count:1});
          if(inventory.length>9)inventory.length=9;
        }
        breakProg=0;breaking=false;
      }
    }
    draw();requestAnimationFrame(gameLoop);
  }
  window.addEventListener('resize',resizeCanvas);
  resizeCanvas();gameLoop();
}

/* ============================================================
   PAC-MAN — Recreado fielmente con animaciones fluidas
   ============================================================ */
function openPacman(){
  const win=createWindow({title:'Pac-Man',icon:'fa-solid fa-circle',width:660,height:560});
  const content=win.querySelector('.window-content');content.style.padding='0';
  const wrap=document.createElement('div');wrap.style.cssText='display:flex;flex-direction:column;align-items:center;background:#000;height:100%;';
  const header=document.createElement('div');header.style.cssText='width:100%;background:#111;padding:5px 14px;display:flex;align-items:center;gap:16px;flex-shrink:0;border-bottom:1px solid #222;';
  header.innerHTML=`<span style="color:#FFD700;font-size:1.1rem;font-weight:900;letter-spacing:.12em;font-family:monospace;">PAC-MAN</span>
    <span style="color:#fff;font-size:.82rem;">PUNTOS: <b id="ps">0</b></span>
    <span style="color:#fff;font-size:.82rem;">VIDAS: <span id="plv">❤️❤️❤️</span></span>
    <span style="color:#fff;font-size:.82rem;margin-left:auto;">NIVEL: <b id="plvl">1</b></span>
    <span style="color:#aaa;font-size:.72rem;">WASD / ↑↓←→</span>`;
  const canvas=document.createElement('canvas');
  wrap.appendChild(header);wrap.appendChild(canvas);content.appendChild(wrap);

  const TILE=22,COLS=20,ROWS=20;
  const ctx=canvas.getContext('2d');
  let W=COLS*TILE,H=ROWS*TILE;canvas.width=W;canvas.height=H;

  // Mapa: 0=corredor 1=muro 2=punto 3=superpunto 4=espacio fantasma
  const MAP=[
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,2,1,1,1,2,1,1,2,1,1,1,2,1,1,3,1],
    [1,2,1,1,2,1,1,1,2,1,1,2,1,1,1,2,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,2,1,1,1,1,1,1,2,1,2,1,1,2,1],
    [1,2,2,2,2,1,2,2,2,1,1,2,2,2,1,2,2,2,2,1],
    [1,1,1,1,2,1,1,4,4,4,4,4,4,1,1,2,1,1,1,1],
    [1,1,1,1,2,1,4,4,4,4,4,4,4,4,1,2,1,1,1,1],
    [0,0,0,1,2,1,4,1,1,4,4,1,1,4,1,2,1,0,0,0],
    [0,0,0,1,2,4,4,1,4,4,4,4,1,4,4,2,1,0,0,0],
    [1,1,1,1,2,1,4,1,1,1,1,1,1,4,1,2,1,1,1,1],
    [1,1,1,1,2,1,4,4,4,4,4,4,4,4,1,2,1,1,1,1],
    [1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,2,1,1,1,2,1,1,2,1,1,1,2,1,1,3,1],
    [1,2,2,1,2,2,2,2,2,2,2,2,2,2,2,2,2,1,2,1],
    [1,1,2,1,2,1,2,1,1,1,1,1,1,2,1,2,1,2,1,1],
    [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];

  let map,dots,score,lives,level,gameState,powTime,powMax,flashTimer;
  let pac,ghosts;

  function init(){
    map=MAP.map(r=>[...r]);
    dots=map.flat().filter(v=>v===2||v===3).length;
    score=0;lives=3;level=1;gameState='playing';powTime=0;powMax=200;flashTimer=0;
    pac={x:10,y:14,tx:10,ty:14,dx:1,dy:0,ndx:1,ndy:0,frame:0,mouthAngle:0.25,mouthDir:1};
    ghosts=[
      {x:9.5,y:9.5,tx:9,ty:9,dx:1,dy:0,color:'#FF0000',scatter:false,frightened:false,eaten:false,homeX:9,homeY:9,name:'Blinky',speed:0.1},
      {x:10.5,y:9.5,tx:10,ty:9,dx:-1,dy:0,color:'#FFB8FF',scatter:false,frightened:false,eaten:false,homeX:10,homeY:9,name:'Pinky',speed:0.09},
      {x:9.5,y:10.5,tx:9,ty:10,dx:0,dy:1,color:'#00FFFF',scatter:false,frightened:false,eaten:false,homeX:9,homeY:10,name:'Inky',speed:0.09},
      {x:10.5,y:10.5,tx:10,ty:10,dx:0,dy:-1,color:'#FFB852',scatter:false,frightened:false,eaten:false,homeX:10,homeY:10,name:'Clyde',speed:0.085},
    ];
    updateUI();
  }
  function updateUI(){
    document.getElementById('ps').textContent=score;
    const lv=document.getElementById('plv');if(lv)lv.textContent='❤️'.repeat(Math.max(0,lives));
    const lvl=document.getElementById('plvl');if(lvl)lvl.textContent=level;
  }

  function canMoveTo(x,y){
    const bx=Math.floor(x),by=Math.floor(y);
    if(bx<0||bx>=COLS||by<0||by>=ROWS)return true; // tunnel
    return map[by][bx]!==1;
  }
  function getCell(x,y){const bx=Math.round(x),by=Math.round(y);if(bx<0||bx>=COLS||by<0||by>=ROWS)return 0;return map[by][bx];}

  // Interpolación suave de movimiento
  let lastTime2=0;
  function update(dt){
    if(gameState!=='playing')return;
    // Pac-Man smooth movement
    pac.frame+=dt*8;
    pac.mouthAngle+=pac.mouthDir*dt*3;
    if(pac.mouthAngle>=0.28){pac.mouthAngle=0.28;pac.mouthDir=-1;}
    if(pac.mouthAngle<=0.01){pac.mouthAngle=0.01;pac.mouthDir=1;}
    const speed=0.08+level*0.005;
    // Try to turn in new direction
    const nx=pac.tx+pac.ndx,ny=pac.ty+pac.ndy;
    if(canMoveTo(nx,ny)&&Math.abs(pac.x-pac.tx)<0.15&&Math.abs(pac.y-pac.ty)<0.15){pac.dx=pac.ndx;pac.dy=pac.ndy;}
    const nx2=pac.tx+pac.dx,ny2=pac.ty+pac.dy;
    if(canMoveTo(nx2,ny2)){pac.tx+=pac.dx*speed;pac.ty+=pac.dy*speed;}
    pac.x+=(pac.tx-pac.x)*0.25;pac.y+=(pac.ty-pac.y)*0.25;
    // Tunnel
    if(pac.tx>=COLS)pac.tx=0;if(pac.tx<0)pac.tx=COLS-1;
    pac.x=pac.tx;
    // Eat dots
    const bx=Math.round(pac.x),by=Math.round(pac.y);
    if(bx>=0&&bx<COLS&&by>=0&&by<ROWS){
      if(map[by][bx]===2){map[by][bx]=0;score+=10;dots--;updateUI();}
      if(map[by][bx]===3){
        map[by][bx]=0;score+=50;dots--;powTime=powMax;flashTimer=0;
        ghosts.forEach(g=>{g.frightened=true;g.eaten=false;g.speed*=0.5;});
        updateUI();
      }
    }
    // Power timer
    if(powTime>0){
      powTime--;flashTimer++;
      if(powTime<=40){// Flash warning
        ghosts.forEach(g=>{if(g.frightened)g._flash=Math.floor(flashTimer/5)%2===0;});}
      if(powTime<=0){ghosts.forEach(g=>{g.frightened=false;g.eaten=false;g._flash=false;g.speed=(0.085+level*0.005);});}
    }
    // Ghost movement - smooth
    ghosts.forEach(g=>{
      if(g.eaten){
        // Return to home quickly
        const tdx=g.homeX-g.x,tdy=g.homeY-g.y;const dist=Math.sqrt(tdx*tdx+tdy*tdy);
        if(dist<0.3){g.eaten=false;g.frightened=false;g.speed=0.1;}
        else{const s=0.2/dist;g.x+=tdx*s*3;g.y+=tdy*s*3;}
        return;
      }
      // Ghost AI: pick direction at intersections
      if(Math.abs(g.x-Math.round(g.x))<0.08&&Math.abs(g.y-Math.round(g.y))<0.08){
        const gx=Math.round(g.x),gy=Math.round(g.y);
        const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
        const valid=dirs.filter(([dx,dy])=>{
          const nx3=gx+dx,ny3=gy+dy;
          return canMoveTo(nx3+dx*0.4,ny3+dy*0.4)&&!(dx===-g.dx&&dy===-g.dy);
        });
        if(valid.length>0){
          let chosen;
          if(g.frightened){chosen=valid[Math.floor(Math.random()*valid.length)];}
          else{
            // Chase Pac-Man
            let best=Infinity;
            valid.forEach(([dx,dy])=>{
              const tx=gx+dx+(g.name==='Pinky'?pac.dx*4:0);
              const ty=gy+dy+(g.name==='Pinky'?pac.dy*4:0);
              const d=Math.abs(tx-pac.x)+Math.abs(ty-pac.y);
              if(d<best){best=d;chosen=[dx,dy];}
            });
          }
          if(chosen){g.dx=chosen[0];g.dy=chosen[1];}
        }
      }
      const gs=g.frightened?g.speed*0.55:g.speed;
      const ngx=g.x+g.dx*gs,ngy=g.y+g.dy*gs;
      if(canMoveTo(ngx,g.y))g.x=ngx;else{g.dx*=-1;}
      if(canMoveTo(g.x,ngy))g.y=ngy;else{g.dy*=-1;}
      // Tunnel
      if(g.x>=COLS)g.x=0;if(g.x<0)g.x=COLS-1;
      // Collision with Pac
      const dist2=Math.abs(g.x-pac.x)+Math.abs(g.y-pac.y);
      if(dist2<0.8){
        if(g.frightened&&!g.eaten){
          g.eaten=true;g.frightened=false;g._flash=false;
          score+=200;updateUI();
          // Score popup
          const gsx=Math.round(g.x)*TILE+TILE/2,gsy=Math.round(g.y)*TILE;
          particles.push({x:gsx,y:gsy,text:'200',life:60,color:'#fff'});
        } else if(!g.eaten&&!g.frightened){
          lives--;updateUI();
          if(lives<=0){gameState='gameover';}else{
            // Reset positions
            pac.x=10;pac.y=14;pac.tx=10;pac.ty=14;pac.dx=1;pac.dy=0;pac.ndx=1;pac.ndy=0;
            ghosts.forEach((g2,i)=>{g2.x=9.5+i%2;g2.y=9.5+Math.floor(i/2);g2.tx=g2.x;g2.ty=g2.y;g2.frightened=false;g2.eaten=false;});
            powTime=0;
          }
        }
      }
    });
    if(dots<=0){level++;init();score+=1000;updateUI();}
  }

  const particles=[];
  function draw2(){
    ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
    // Draw maze
    for(let by=0;by<ROWS;by++)for(let bx=0;bx<COLS;bx++){
      const cell=map[by][bx];const sx=bx*TILE,sy=by*TILE;
      if(cell===1){
        // Gradient wall
        ctx.fillStyle='#1a1aff';ctx.fillRect(sx+1,sy+1,TILE-2,TILE-2);
        ctx.strokeStyle='#3333ff';ctx.lineWidth=1;ctx.strokeRect(sx+1.5,sy+1.5,TILE-3,TILE-3);
        ctx.fillStyle='rgba(100,100,255,.15)';ctx.fillRect(sx+1,sy+1,TILE-2,4);
      }
      else if(cell===2){ctx.fillStyle='#FFD700';ctx.beginPath();ctx.arc(sx+TILE/2,sy+TILE/2,2.5,0,Math.PI*2);ctx.fill();}
      else if(cell===3){
        ctx.fillStyle='#FFD700';ctx.beginPath();ctx.arc(sx+TILE/2,sy+TILE/2,6,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(255,215,0,.4)';ctx.beginPath();ctx.arc(sx+TILE/2,sy+TILE/2,9,0,Math.PI*2);ctx.fill();
      }
    }
    // Ghost house door
    ctx.strokeStyle='#FFB8FF';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(8.5*TILE,7*TILE);ctx.lineTo(11.5*TILE,7*TILE);ctx.stroke();
    // Particles (score popups)
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];ctx.fillStyle=p.color;ctx.globalAlpha=p.life/60;ctx.font='bold 13px monospace';ctx.textAlign='center';ctx.fillText(p.text,p.x,p.y-((60-p.life)*0.3));ctx.globalAlpha=1;p.life--;p.y-=0.5;if(p.life<=0)particles.splice(i,1);
    }
    // Ghosts
    ghosts.forEach(g=>{
      const gx=g.x*TILE+TILE/2,gy=g.y*TILE+TILE/2;
      if(g.eaten){
        // Draw eyes only (going home)
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(gx-3,gy-3,4,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(gx+3,gy-3,4,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#00f';ctx.beginPath();ctx.arc(gx-2+g.dx*2,gy-2+g.dy*2,2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(gx+4+g.dx*2,gy-2+g.dy*2,2,0,Math.PI*2);ctx.fill();
        return;
      }
      let gc=g.frightened?(g._flash?'#fff':'#0000bb'):g.color;
      // Body
      const gr=ctx.createRadialGradient(gx,gy-2,1,gx,gy,TILE/2-2);
      gr.addColorStop(0,gc);gr.addColorStop(1,gc+'99');
      ctx.fillStyle=gr;
      ctx.beginPath();ctx.arc(gx,gy-2,TILE/2-3,Math.PI,0,false);
      // Wavy bottom
      ctx.lineTo(gx+TILE/2-3,gy+TILE/2-3);
      for(let w=0;w<3;w++){ctx.quadraticCurveTo(gx+(TILE/2-3)-(w*8+4),gy+TILE/2-3+5,gx+(TILE/2-3)-(w*8+8),gy+TILE/2-3);}
      ctx.closePath();ctx.fill();
      if(!g.frightened){
        // Eyes
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(gx-3,gy-4,4,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(gx+3,gy-4,4,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#00f';const ex=g.dx*2,ey=g.dy*2;ctx.beginPath();ctx.arc(gx-2+ex,gy-3+ey,2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(gx+4+ex,gy-3+ey,2,0,Math.PI*2);ctx.fill();
      } else {
        // Scared face
        ctx.fillStyle=g._flash?'#ff6b6b':'#fff';ctx.font='10px serif';ctx.textAlign='center';ctx.fillText('ˇ_ˇ',gx,gy);
      }
    });
    // Pac-Man with smooth mouth animation
    const pcx=pac.x*TILE+TILE/2,pcy=pac.y*TILE+TILE/2;
    const angleOffset=Math.atan2(pac.dy,pac.dx);
    const mouth=pac.mouthAngle;
    // Glow
    const pacGlow=ctx.createRadialGradient(pcx,pcy,1,pcx,pcy,TILE/2+2);
    pacGlow.addColorStop(0,'rgba(255,230,0,.3)');pacGlow.addColorStop(1,'rgba(255,215,0,0)');
    ctx.fillStyle=pacGlow;ctx.beginPath();ctx.arc(pcx,pcy,TILE/2+4,0,Math.PI*2);ctx.fill();
    // Body
    const pacGrad=ctx.createRadialGradient(pcx-2,pcy-2,1,pcx,pcy,TILE/2);
    pacGrad.addColorStop(0,'#FFE030');pacGrad.addColorStop(1,'#FFB800');
    ctx.fillStyle=pacGrad;
    ctx.beginPath();ctx.moveTo(pcx,pcy);
    ctx.arc(pcx,pcy,TILE/2-2,angleOffset+mouth*Math.PI,angleOffset+(2-mouth)*Math.PI);
    ctx.closePath();ctx.fill();
    // Eye
    const eyeX=pcx+Math.cos(angleOffset-Math.PI/3)*5,eyeY=pcy+Math.sin(angleOffset-Math.PI/3)*5;
    ctx.fillStyle='#333';ctx.beginPath();ctx.arc(eyeX,eyeY,1.5,0,Math.PI*2);ctx.fill();

    // Overlay states
    if(gameState==='gameover'){
      ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#f00';ctx.font='bold 32px monospace';ctx.textAlign='center';ctx.fillText('GAME OVER',W/2,H/2-20);
      ctx.fillStyle='#FFD700';ctx.font='18px monospace';ctx.fillText('PUNTOS: '+score,W/2,H/2+10);
      ctx.fillStyle='#fff';ctx.font='13px monospace';ctx.fillText('Presiona R para reiniciar',W/2,H/2+38);
    }
    if(gameState==='win'){
      ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#FFD700';ctx.font='bold 28px monospace';ctx.textAlign='center';ctx.fillText('¡NIVEL COMPLETADO!',W/2,H/2);
      ctx.fillStyle='#fff';ctx.font='14px monospace';ctx.fillText('PUNTOS: '+score,W/2,H/2+30);
    }
  }

  // Input
  const keyHandler=e=>{
    if(!win.isConnected){document.removeEventListener('keydown',keyHandler);return;}
    if(gameState==='gameover'&&(e.key==='r'||e.key==='R')){init();return;}
    const dirs={'ArrowLeft':[-1,0],'ArrowRight':[1,0],'ArrowUp':[0,-1],'ArrowDown':[0,1],'a':[-1,0],'d':[1,0],'w':[0,-1],'s':[0,1]};
    if(dirs[e.key]){[pac.ndx,pac.ndy]=dirs[e.key];e.preventDefault();}
  };
  document.addEventListener('keydown',keyHandler);

  let lastTs=0;
  function loop(ts){
    if(!win.isConnected){document.removeEventListener('keydown',keyHandler);return;}
    const dt=Math.min((ts-lastTs)/1000*60,3);lastTs=ts;
    update(dt);draw2();requestAnimationFrame(loop);
  }
  init();requestAnimationFrame(loop);
}

/* ============================================================
   JUEGOS RECREADOS EN CANVAS
   ============================================================ */

/* ── DINO RUNNER ─────────────────────────────────────────── */
function openDino(){
  const win=createWindow({title:'Dinosaur Game',icon:'fa-solid fa-dragon',width:700,height:280});
  const content=win.querySelector('.window-content');content.style.padding='0';
  const wrap=document.createElement('div');wrap.style.cssText='background:#fff;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;';
  const scoreDiv=document.createElement('div');scoreDiv.style.cssText='position:absolute;top:8px;right:14px;font-family:monospace;font-size:1rem;font-weight:700;color:#535353;letter-spacing:.1em;';scoreDiv.id='dino-score';scoreDiv.textContent='00000';
  const canvas=document.createElement('canvas');canvas.width=700;canvas.height=150;canvas.style.cssText='display:block;cursor:pointer;';
  const msgDiv=document.createElement('div');msgDiv.style.cssText='position:absolute;text-align:center;font-family:monospace;font-weight:700;color:#535353;font-size:.85rem;';
  msgDiv.innerHTML='Presiona <b>ESPACIO</b> o <b>↑</b> para comenzar<br><small style="font-size:.72rem;color:#888;">↑/SPACE = saltar &nbsp; ↓ = agacharse</small>';
  wrap.appendChild(scoreDiv);wrap.appendChild(canvas);wrap.appendChild(msgDiv);content.appendChild(wrap);
  const ctx2=canvas.getContext('2d');
  let score2=0,speed=5,gameOver2=false,started=false;
  let dino={x:60,y:110,vy:0,h:40,w:26,ducking:false,frame:0,legAnim:0};
  let obstacles=[],clouds=[],groundX=0,hiScore=0;
  const GROUND=110,GRAV=0.6,JUMP=-13;
  function newObs(){
    const types=[{w:16,h:30,y:GROUND+dino.h-30},{w:26,h:48,y:GROUND+dino.h-48},{w:12,h:55,y:GROUND+dino.h-55},{w:48,h:30,y:GROUND+dino.h-30}];
    const t=types[Math.floor(Math.random()*types.length)];
    let x=700+Math.floor(Math.random()*200);
    if(obstacles.length>0)x=Math.max(x,obstacles[obstacles.length-1].x+120+Math.random()*80);
    // Flying pterodactyl at high speed
    const flying=speed>10&&Math.random()<0.2;
    obstacles.push({x,y:flying?GROUND+dino.h-60+Math.floor(Math.random()*30):t.y,w:flying?34:t.w,h:flying?26:t.h,flying,fFrame:0});
  }
  function drawDino(){
    const dx=dino.x,dy=GROUND+dino.h-(dino.ducking?22:dino.h);
    const dh=dino.ducking?22:dino.h,dw=dino.ducking?40:dino.w;
    ctx2.fillStyle='#535353';
    if(gameOver2){
      // X eyes
      ctx2.fillRect(dx,dy,dw,dh);
      ctx2.fillStyle='#fff';ctx2.fillRect(dx+dw-10,dy+4,7,7);
      ctx2.fillStyle='#535353';ctx2.font='bold 10px serif';ctx2.fillText('✕',dx+dw-10,dy+12);
    } else {
      // Body
      ctx2.fillRect(dx,dy,dw,dh);
      // Eye
      ctx2.fillStyle='#fff';ctx2.fillRect(dx+dw-8,dy+4,7,7);
      ctx2.fillStyle='#535353';ctx2.fillRect(dx+dw-6,dy+6,3,3);
      // Beak
      ctx2.fillStyle='#535353';ctx2.fillRect(dx+dw,dy+8,6,4);
      // Arm
      ctx2.fillRect(dx+6,dy+dh-14,10,6);
      if(!dino.ducking){
        // Legs animated
        dino.legAnim+=speed*0.08;
        const l1=Math.sin(dino.legAnim)*5,l2=Math.cos(dino.legAnim)*5;
        ctx2.fillRect(dx+4,dy+dh,8,8+l1);
        ctx2.fillRect(dx+14,dy+dh,8,8-l1);
      }
    }
  }
  function drawObs(o){
    ctx2.fillStyle='#535353';
    if(o.flying){
      o.fFrame+=0.15;
      // Pterodactyl body
      ctx2.fillRect(o.x,o.y+8,o.w,12);
      // Wings flapping
      const wA=Math.sin(o.fFrame)*8;
      ctx2.fillRect(o.x+4,o.y+wA,10,8);ctx2.fillRect(o.x+o.w-14,o.y-wA,10,8);
      ctx2.fillRect(o.x+o.w-6,o.y+10,6,6);// beak
    } else {
      // Cactus
      ctx2.fillRect(o.x,o.y,o.w,o.h);
      // Side branches
      ctx2.fillRect(o.x-6,o.y+o.h*0.3,6,10);ctx2.fillRect(o.x-6,o.y+o.h*0.1,4,o.h*0.3);
      ctx2.fillRect(o.x+o.w,o.y+o.h*0.4,6,10);ctx2.fillRect(o.x+o.w+2,o.y+o.h*0.15,4,o.h*0.4);
    }
  }
  function loop2(){
    if(!win.isConnected)return;
    ctx2.fillStyle='#fff';ctx2.fillRect(0,0,700,150);
    // Ground
    ctx2.fillStyle='#535353';ctx2.fillRect(0,GROUND+dino.h+2,700,2);
    // Dotted ground texture
    ctx2.fillStyle='#aaa';for(let i=0;i<20;i++){ctx2.fillRect(((i*80-groundX)%700+700)%700,GROUND+dino.h+6,40,1);}
    // Clouds
    clouds.forEach(c=>{ctx2.fillStyle='#ddd';ctx2.fillRect(c.x,c.y,60,12);ctx2.fillRect(c.x+8,c.y-7,44,12);ctx2.fillRect(c.x+16,c.y-13,28,12);c.x-=speed*0.15;});
    clouds=clouds.filter(c=>c.x>-70);if(Math.random()<0.008)clouds.push({x:710,y:20+Math.random()*40});
    if(!started){drawDino();msgDiv.style.display='block';requestAnimationFrame(loop2);return;}
    msgDiv.style.display='none';
    if(!gameOver2){
      score2+=0.1;speed=5+score2*0.002;
      scoreDiv.textContent=String(Math.floor(score2)).padStart(5,'0');
      groundX=(groundX+speed)%700;
      // Physics
      dino.vy+=GRAV;dino.y=Math.max(0,dino.y+dino.vy);if(dino.y<=0){dino.y=0;dino.vy=0;}
      // Obstacles
      if(!obstacles.length||obstacles[obstacles.length-1].x<500-Math.random()*150)newObs();
      obstacles.forEach(o=>o.x-=speed);
      obstacles=obstacles.filter(o=>o.x>-60);
      // Collision
      const dx=dino.x,dy=GROUND-dino.y+(dino.ducking?dino.h-22:0);
      const dh=dino.ducking?22:dino.h,dw=dino.w;
      obstacles.forEach(o=>{if(dx+dw-4>o.x+2&&dx+4<o.x+o.w-2&&dy+4<o.y+o.h&&dy+dh-4>o.y){gameOver2=true;if(score2>hiScore)hiScore=Math.floor(score2);}});
    } else {
      // Game over screen
      ctx2.fillStyle='#535353';ctx2.font='bold 18px monospace';ctx2.textAlign='center';ctx2.fillText('GAME OVER',350,60);
      ctx2.font='12px monospace';ctx2.fillText('HI '+String(hiScore).padStart(5,'0'),350,82);
      ctx2.fillText('Presiona ESPACIO para reiniciar',350,102);
    }
    drawDino();
    obstacles.forEach(drawObs);
    requestAnimationFrame(loop2);
  }
  const dinoKey=e=>{
    if(!win.isConnected){document.removeEventListener('keydown',dinoKey);document.removeEventListener('keyup',dinoKeyUp);return;}
    if(e.key===' '||e.key==='ArrowUp'||e.key==='w'){
      e.preventDefault();
      if(!started){started=true;return;}
      if(gameOver2){gameOver2=false;score2=0;speed=5;obstacles=[];dino.y=0;dino.vy=0;return;}
      if(dino.y<=0)dino.vy=JUMP;
    }
    if(e.key==='ArrowDown'||e.key==='s'){dino.ducking=true;}
  };
  const dinoKeyUp=e=>{if(e.key==='ArrowDown'||e.key==='s')dino.ducking=false;};
  document.addEventListener('keydown',dinoKey);document.addEventListener('keyup',dinoKeyUp);
  canvas.addEventListener('click',()=>{if(!started){started=true;return;}if(gameOver2){gameOver2=false;score2=0;speed=5;obstacles=[];dino.y=0;dino.vy=0;return;}if(dino.y<=0)dino.vy=JUMP;});
  requestAnimationFrame(loop2);
}

/* ── LEVEL DEVIL ─────────────────────────────────────────── */
function openLevelDevil(){
  const win=createWindow({title:'Level Devil',icon:'fa-solid fa-skull',width:700,height:500});
  const content=win.querySelector('.window-content');content.style.padding='0';
  const canvas=document.createElement('canvas');canvas.width=700;canvas.height=460;canvas.style.display='block';
  const hud=document.createElement('div');hud.style.cssText='background:#1a0000;padding:5px 14px;display:flex;gap:14px;align-items:center;font-family:monospace;font-size:.78rem;color:#ff4444;flex-shrink:0;';
  hud.innerHTML=`<span style="color:#ff0;font-weight:900;font-size:.9rem;">LEVEL DEVIL</span><span>Nivel: <b id="ld-lvl">1</b></span><span>Muertes: <b id="ld-deaths">0</b></span><span style="margin-left:auto;color:#888;">WASD / Flechas | SPACE = saltar</span>`;
  const wrap=document.createElement('div');wrap.style.cssText='background:#1a0000;height:100%;display:flex;flex-direction:column;';
  wrap.appendChild(hud);wrap.appendChild(canvas);content.appendChild(wrap);
  const ctx3=canvas.getContext('2d');
  const W=700,H=460,TILE2=28,GRAV2=0.5,JUMP2=-12;
  let deaths=0,levelNum=1;

  // Niveles con trampas
  const LEVELS=[
    {// Nivel 1: básico con trampa
      tiles:[
        '         ____     ',
        '        /    \\    ',
        '  ##    |    |    ',
        '  ##   _|    |_   ',
        '__##__/        \\__',
        '                  ',
        '##########  ######',
        '           P      ',
        '##################',
      ],
      traps:[{type:'spike',x:9,y:5,dir:'up'},{type:'door',x:16,y:5}],
    },
    {// Nivel 2
      tiles:[
        '                  ',
        ' #####   #######  ',
        '     #   #        ',
        '     ### #  ####  ',
        '                  ',
        ' ####         ##  ',
        '    P    ###  ##  ',
        ' ####################',
      ],
      traps:[{type:'spike',x:7,y:3,dir:'up'},{type:'spike',x:12,y:3,dir:'down'},{type:'door',x:17,y:4}],
    },
  ];

  function getLevel(n){return LEVELS[Math.min(n-1,LEVELS.length-1)];}

  let player={x:60,y:200,vx:0,vy:0,w:20,h:28,onGround:false,dead:false};
  let doorPos={x:600,y:140};
  let platforms=[];
  let traps2=[];
  let camX2=0;
  const keys2={};

  function buildLevel(n){
    platforms=[];traps2=[];
    player={x:60,y:350,vx:0,vy:0,w:20,h:28,onGround:false,dead:false};
    doorPos={x:600,y:280};
    // Simple generated platforms
    const plats=[
      {x:0,y:420,w:700,h:40},// floor
      {x:100,y:350,w:120,h:16},{x:300,y:300,w:100,h:16},{x:450,y:260,w:130,h:16},
      {x:200,y:230,w:80,h:16},{x:550,y:340,w:120,h:16},{x:620,y:200,w:80,h:16},
    ];
    // Add traps based on level
    const spikePositions=[[150,404],[320,284],[470,244],[560,324]];
    const usedSpikes=Math.min(n,spikePositions.length);
    for(let i=0;i<usedSpikes;i++)traps2.push({type:'spike',x:spikePositions[i][0],y:spikePositions[i][1],w:16,h:16,anim:0});
    // Moving platform in higher levels
    if(n>=2)platforms.push({x:360,y:310,w:80,h:16,mx:1,range:100,ox:360});
    platforms.push(...plats);
    doorPos={x:630+n*10,y:plats[plats.length-1].y-50};
  }

  buildLevel(1);

  function update3(){
    if(player.dead){player.deadTimer=(player.deadTimer||0)+1;if(player.deadTimer>60){deaths++;document.getElementById('ld-deaths').textContent=deaths;buildLevel(levelNum);player.deadTimer=0;}return;}
    const acc=0.4,fric=0.82;
    if(keys2['a']||keys2['ArrowLeft'])player.vx-=acc;
    if(keys2['d']||keys2['ArrowRight'])player.vx+=acc;
    if((keys2[' ']||keys2['w']||keys2['ArrowUp'])&&player.onGround){player.vy=JUMP2;player.onGround=false;}
    player.vx*=fric;if(Math.abs(player.vx)>5)player.vx=5*Math.sign(player.vx);
    player.vy+=GRAV2;if(player.vy>12)player.vy=12;
    // X move
    player.x+=player.vx;
    platforms.forEach(p=>{if(p.mx){p.x+=p.mx;if(p.x>p.ox+p.range||p.x<p.ox-p.range)p.mx*=-1;}
      if(player.x+player.w>p.x&&player.x<p.x+p.w&&player.y+player.h>p.y&&player.y<p.y+p.h){if(player.vx>0)player.x=p.x-player.w;else player.x=p.x+p.w;player.vx=0;}
    });
    // Y move
    player.onGround=false;player.y+=player.vy;
    platforms.forEach(p=>{
      if(player.x+player.w>p.x+2&&player.x<p.x+p.w-2&&player.y+player.h>p.y&&player.y+player.h<p.y+p.h+10&&player.vy>=0){player.y=p.y-player.h;player.vy=0;player.onGround=true;}
      else if(player.x+player.w>p.x&&player.x<p.x+p.w&&player.y<p.y+p.h&&player.y>p.y&&player.vy<0){player.y=p.y+p.h;player.vy=0;}
    });
    if(player.y>H+50)player.dead=true;
    // Spikes
    traps2.forEach(t=>{t.anim=(t.anim||0)+0.05;if(t.type==='spike'){if(player.x+player.w>t.x+2&&player.x<t.x+t.w-2&&player.y+player.h>t.y&&player.y<t.y+t.h)player.dead=true;}});
    // Door = next level
    if(Math.abs(player.x+player.w/2-doorPos.x-14)<24&&Math.abs(player.y-doorPos.y)<40){levelNum++;if(levelNum>5)levelNum=1;buildLevel(levelNum);document.getElementById('ld-lvl').textContent=levelNum;}
    camX2=player.x-W/2;camX2=Math.max(0,Math.min(700,camX2));
  }

  function draw3(){
    if(!win.isConnected)return;
    ctx3.fillStyle='#1a0000';ctx3.fillRect(0,0,W,H);
    // Background stars
    ctx3.fillStyle='rgba(255,50,50,.3)';
    for(let s=0;s<20;s++){ctx3.beginPath();ctx3.arc((s*137)%W,(s*97+31)%H,1,0,Math.PI*2);ctx3.fill();}
    ctx3.save();ctx3.translate(-camX2,0);
    // Platforms
    platforms.forEach(p=>{
      const pg=ctx3.createLinearGradient(p.x,p.y,p.x,p.y+p.h);
      pg.addColorStop(0,'#444');pg.addColorStop(1,'#222');
      ctx3.fillStyle=pg;ctx3.fillRect(p.x,p.y,p.w,p.h);
      ctx3.fillStyle='rgba(255,100,100,.2)';ctx3.fillRect(p.x,p.y,p.w,3);
    });
    // Spikes
    traps2.forEach(t=>{
      if(t.type==='spike'){
        const pulse=Math.sin(t.anim)*0.3+0.7;ctx3.fillStyle=`rgba(255,50,50,${pulse})`;
        ctx3.beginPath();ctx3.moveTo(t.x,t.y+t.h);ctx3.lineTo(t.x+t.w/2,t.y);ctx3.lineTo(t.x+t.w,t.y+t.h);ctx3.closePath();ctx3.fill();
        ctx3.fillStyle='rgba(255,150,150,.5)';ctx3.beginPath();ctx3.moveTo(t.x+4,t.y+t.h);ctx3.lineTo(t.x+t.w/2,t.y+5);ctx3.lineTo(t.x+t.w-4,t.y+t.h);ctx3.closePath();ctx3.fill();
      }
    });
    // Door
    ctx3.fillStyle='#FFD700';
    ctx3.fillRect(doorPos.x,doorPos.y,28,40);
    ctx3.fillStyle='rgba(0,0,0,.5)';ctx3.fillRect(doorPos.x+10,doorPos.y+22,8,18);
    ctx3.fillStyle='#FFD700';ctx3.font='bold 16px serif';ctx3.textAlign='center';ctx3.fillText('🏆',doorPos.x+14,doorPos.y-5);
    // Player
    if(player.dead&&(player.deadTimer||0)%6<3){ctx3.restore();requestAnimationFrame(draw3);update3();return;}
    const run=player.onGround&&Math.abs(player.vx)>0.5;
    const frame3=run?Math.floor(Date.now()/100)%4:0;
    ctx3.fillStyle=player.dead?'#ff4444':'#ff6666';
    ctx3.fillRect(player.x,player.y,player.w,player.h);
    // Devil horns
    ctx3.fillStyle=player.dead?'#ff0000':'#cc0000';
    ctx3.beginPath();ctx3.moveTo(player.x+3,player.y);ctx3.lineTo(player.x,player.y-8);ctx3.lineTo(player.x+7,player.y);ctx3.fill();
    ctx3.beginPath();ctx3.moveTo(player.x+player.w-3,player.y);ctx3.lineTo(player.x+player.w,player.y-8);ctx3.lineTo(player.x+player.w-7,player.y);ctx3.fill();
    // Eyes
    ctx3.fillStyle='#ffff00';ctx3.fillRect(player.x+4,player.y+6,4,4);ctx3.fillRect(player.x+12,player.y+6,4,4);
    ctx3.fillStyle='#000';ctx3.fillRect(player.x+5,player.y+7,2,2);ctx3.fillRect(player.x+13,player.y+7,2,2);
    // Legs
    if(run){ctx3.fillStyle='#cc0000';ctx3.fillRect(player.x+2+(frame3%2)*4,player.y+player.h,6,8);ctx3.fillRect(player.x+12-(frame3%2)*4,player.y+player.h,6,8);}
    else{ctx3.fillStyle='#cc0000';ctx3.fillRect(player.x+3,player.y+player.h,6,8);ctx3.fillRect(player.x+11,player.y+player.h,6,8);}
    ctx3.restore();
    requestAnimationFrame(draw3);update3();
  }
  const k3d=e=>{if(!win.isConnected){document.removeEventListener('keydown',k3d);document.removeEventListener('keyup',k3u);return;}keys2[e.key]=true;if([' ','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();};
  const k3u=e=>{keys2[e.key]=false;};
  document.addEventListener('keydown',k3d);document.addEventListener('keyup',k3u);
  requestAnimationFrame(draw3);
}

/* ── SUSHI PARTY IO (2 jugadores) ────────────────────────── */
function openSushiParty(){
  const win=createWindow({title:'Sushi Party IO — 2 Jugadores',icon:'fa-solid fa-fish',width:700,height:520});
  const content=win.querySelector('.window-content');content.style.padding='0';
  const canvas=document.createElement('canvas');canvas.width=700;canvas.height=480;
  const hud=document.createElement('div');hud.style.cssText='background:#1a1a2e;padding:5px 14px;display:flex;gap:14px;align-items:center;font-family:monospace;font-size:.78rem;color:#fff;flex-shrink:0;';
  hud.innerHTML=`<span style="color:#ff6680;font-weight:900;">🍣 SUSHI PARTY</span><span style="color:#4fc3f7;">J1: <b id="sp-s1">0</b></span><span style="color:#ffb74d;">J2: <b id="sp-s2">0</b></span><span style="margin-left:auto;color:#aaa;">J1:WASD  J2:Flechas</span>`;
  const wrap=document.createElement('div');wrap.style.cssText='background:#0d0d1a;height:100%;display:flex;flex-direction:column;';
  wrap.appendChild(hud);wrap.appendChild(canvas);content.appendChild(wrap);
  const c=canvas.getContext('2d');const W=700,H=480;
  const SEG=12;
  // Snakes
  let s1={segs:[{x:10,y:10},{x:9,y:10},{x:8,y:10}],dx:1,dy:0,ndx:1,ndy:0,color:'#4fc3f7',score:0,alive:true,boost:false,boostTime:0};
  let s2={segs:[{x:48,y:30},{x:49,y:30},{x:50,y:30}],dx:-1,dy:0,ndx:-1,ndy:0,color:'#ffb74d',score:0,alive:true,boost:false,boostTime:0};
  const COLS2=Math.floor(W/SEG),ROWS2=Math.floor(H/SEG);
  let foods=[];let sushiTypes=['🍣','🍤','🍙','🥟','🦐','⭐','💎'];
  function spawnFood(n){for(let i=0;i<n;i++)foods.push({x:Math.floor(Math.random()*COLS2),y:Math.floor(Math.random()*ROWS2),type:Math.floor(Math.random()*sushiTypes.length),glow:0});}
  spawnFood(12);
  let tick=0,gameOver3=false,winner='';
  function updateSnake(s){
    if(!s.alive)return;
    s.dx=s.ndx;s.dy=s.ndy;
    const head={x:((s.segs[0].x+s.dx)%COLS2+COLS2)%COLS2,y:((s.segs[0].y+s.dy)%ROWS2+ROWS2)%ROWS2};
    // Self collision
    if(s.segs.slice(2).some(seg=>seg.x===head.x&&seg.y===head.y)){s.alive=false;return;}
    // Eat
    const fi=foods.findIndex(f=>f.x===head.x&&f.y===head.y);
    if(fi>=0){const f=foods[fi];s.score+=f.type===6?5:f.type===5?3:1;foods.splice(fi,1);if(Math.random()<0.5)spawnFood(1);}
    else s.segs.pop();
    s.segs.unshift(head);
  }
  function checkCollide(){
    if(!s1.alive||!s2.alive)return;
    if(s1.segs[0].x===s2.segs[0].x&&s1.segs[0].y===s2.segs[0].y){s1.alive=false;s2.alive=false;winner='Empate';}
    else if(s2.segs.some(seg=>seg.x===s1.segs[0].x&&seg.y===s1.segs[0].y)){s1.alive=false;winner='Jugador 2';}
    else if(s1.segs.some(seg=>seg.x===s2.segs[0].x&&seg.y===s2.segs[0].y)){s2.alive=false;winner='Jugador 1';}
  }
  function drawSnake(s){
    s.segs.forEach((seg,i)=>{
      const isHead=i===0;const x=seg.x*SEG,y=seg.y*SEG;
      const t=1-i/s.segs.length;
      ctx.fillStyle=isHead?s.color:`rgba(${parseInt(s.color.slice(1,3),16)},${parseInt(s.color.slice(3,5),16)},${parseInt(s.color.slice(5,7),16)},${0.4+t*0.6})`;
      if(isHead){ctx.beginPath();ctx.roundRect(x+1,y+1,SEG-2,SEG-2,4);ctx.fill();}
      else{ctx.fillRect(x+2,y+2,SEG-4,SEG-4);}
    });
    // Eyes on head
    const h=s.segs[0];const hx=h.x*SEG+SEG/2,hy=h.y*SEG+SEG/2;
    const ea=[s.dx===0?-3:0,s.dy===0?-3:0],eb=[s.dx===0?3:0,s.dy===0?3:0];
    ctx.fillStyle='#fff';ctx.fillRect(hx+ea[0]-1+s.dx*2,hy+ea[1]-1+s.dy*2,3,3);ctx.fillRect(hx+eb[0]-1+s.dx*2,hy+eb[1]-1+s.dy*2,3,3);
    ctx.fillStyle='#000';ctx.fillRect(hx+ea[0]+s.dx*2,hy+ea[1]+s.dy*2,2,2);ctx.fillRect(hx+eb[0]+s.dx*2,hy+eb[1]+s.dy*2,2,2);
  }
  let lastT4=0;
  function loop4(ts){
    if(!win.isConnected)return;
    ctx.fillStyle='#0d0d1a';ctx.fillRect(0,0,W,H);
    // Grid
    ctx.strokeStyle='rgba(255,255,255,.03)';ctx.lineWidth=1;
    for(let x=0;x<W;x+=SEG){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=SEG){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    // Food
    foods.forEach(f=>{
      f.glow=(f.glow||0)+0.08;const g=Math.sin(f.glow)*3;
      ctx.font=`${12+g}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(sushiTypes[f.type],f.x*SEG+SEG/2,f.y*SEG+SEG/2);
    });
    if(!gameOver3){
      if(ts-lastT4>100){lastT4=ts;tick++;updateSnake(s1);updateSnake(s2);checkCollide();document.getElementById('sp-s1').textContent=s1.score;document.getElementById('sp-s2').textContent=s2.score;}
      if(!s1.alive||!s2.alive){gameOver3=true;winner=winner||(!s1.alive&&!s2.alive?'Empate':!s1.alive?'Jugador 2 gana!':'Jugador 1 gana!');}
    }
    drawSnake(s1);drawSnake(s2);
    if(gameOver3){
      ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#FFD700';ctx.font='bold 28px monospace';ctx.textAlign='center';ctx.fillText(winner,W/2,H/2-15);
      ctx.fillStyle='#fff';ctx.font='14px monospace';ctx.fillText('J1:'+s1.score+' pts  —  J2:'+s2.score+' pts',W/2,H/2+15);
      ctx.font='12px monospace';ctx.fillStyle='#aaa';ctx.fillText('Presiona R para reiniciar',W/2,H/2+42);
    }
    requestAnimationFrame(loop4);
  }
  const sp4k=e=>{
    if(!win.isConnected){document.removeEventListener('keydown',sp4k);return;}
    if(e.key==='r'||e.key==='R'){s1={segs:[{x:10,y:10},{x:9,y:10},{x:8,y:10}],dx:1,dy:0,ndx:1,ndy:0,color:'#4fc3f7',score:0,alive:true};s2={segs:[{x:48,y:30},{x:49,y:30},{x:50,y:30}],dx:-1,dy:0,ndx:-1,ndy:0,color:'#ffb74d',score:0,alive:true};foods=[];spawnFood(12);gameOver3=false;winner='';return;}
    if(s1.alive){if(e.key==='w'&&s1.dy===0){s1.ndx=0;s1.ndy=-1;}if(e.key==='s'&&s1.dy===0){s1.ndx=0;s1.ndy=1;}if(e.key==='a'&&s1.dx===0){s1.ndx=-1;s1.ndy=0;}if(e.key==='d'&&s1.dx===0){s1.ndx=1;s1.ndy=0;}}
    if(s2.alive){if(e.key==='ArrowUp'&&s2.dy===0){s2.ndx=0;s2.ndy=-1;e.preventDefault();}if(e.key==='ArrowDown'&&s2.dy===0){s2.ndx=0;s2.ndy=1;e.preventDefault();}if(e.key==='ArrowLeft'&&s2.dx===0){s2.ndx=-1;s2.ndy=0;e.preventDefault();}if(e.key==='ArrowRight'&&s2.dx===0){s2.ndx=1;s2.ndy=0;e.preventDefault();}}
  };
  document.addEventListener('keydown',sp4k);
  requestAnimationFrame(loop4);
}

/* ── APPLE WORM ──────────────────────────────────────────── */
function openAppleWorm(){
  const win=createWindow({title:'Apple Worm',icon:'fa-solid fa-apple-whole',width:600,height:480});
  const content=win.querySelector('.window-content');content.style.padding='0';
  const canvas=document.createElement('canvas');canvas.width=600;canvas.height=440;
  const hud=document.createElement('div');hud.style.cssText='background:#1e3a1e;padding:5px 14px;display:flex;gap:12px;align-items:center;font-family:monospace;font-size:.78rem;color:#fff;flex-shrink:0;';
  hud.innerHTML=`<span style="color:#7ae;font-weight:900;">🍎 APPLE WORM</span><span>Nivel: <b id="aw-lvl">1</b></span><span>Manzanas: <b id="aw-score">0</b></span><span style="margin-left:auto;color:#aaa;">← →=mover | ↑=saltar</span>`;
  const wrap=document.createElement('div');wrap.style.cssText='background:#1e3a1e;height:100%;display:flex;flex-direction:column;';
  wrap.appendChild(hud);wrap.appendChild(canvas);content.appendChild(wrap);
  const ctx4=canvas.getContext('2d');const W=600,H=440,T=24;
  const COLS3=Math.floor(W/T),ROWS3=Math.floor(H/T);
  let worm,apple,walls,level,totalApples;
  function initLevel(n){
    level=n;worm=[{x:3,y:ROWS3-3},{x:2,y:ROWS3-3},{x:1,y:ROWS3-3}];
    walls=[];for(let x=0;x<COLS3;x++){walls.push({x,y:0});walls.push({x,y:ROWS3-1});}
    for(let y=1;y<ROWS3-1;y++){walls.push({x:0,y});walls.push({x:COLS3-1,y});}
    // Add internal walls per level
    for(let i=0;i<n*3;i++){const wx=3+Math.floor(Math.random()*(COLS3-6)),wy=2+Math.floor(Math.random()*(ROWS3-4));for(let j=0;j<3+n;j++)walls.push({x:wx+j,y:wy});}
    placeApple();totalApples=0;
    document.getElementById('aw-lvl').textContent=n;
  }
  function placeApple(){
    let ax,ay;do{ax=1+Math.floor(Math.random()*(COLS3-2));ay=1+Math.floor(Math.random()*(ROWS3-2));}
    while(worm.some(s=>s.x===ax&&s.y===ay)||walls.some(w=>w.x===ax&&w.y===ay));
    apple={x:ax,y:ay,glow:0,bounce:0};
  }
  let dx3=1,dy3=0,ndx3=1,ndy3=0,gameOver4=false,moving=false;
  function update4(){
    if(gameOver4)return;
    dx3=ndx3;dy3=ndy3;
    const head={x:worm[0].x+dx3,y:worm[0].y+dy3};
    if(walls.some(w=>w.x===head.x&&w.y===head.y)||worm.some(s=>s.x===head.x&&s.y===head.y)){gameOver4=true;return;}
    worm.unshift(head);
    if(head.x===apple.x&&head.y===apple.y){totalApples++;document.getElementById('aw-score').textContent=totalApples;if(totalApples%5===0)initLevel(level+1);else placeApple();}
    else worm.pop();
  }
  function draw4(){
    if(!win.isConnected)return;
    ctx4.fillStyle='#1e3a1e';ctx4.fillRect(0,0,W,H);
    // Grid
    ctx4.strokeStyle='rgba(255,255,255,.04)';ctx4.lineWidth=1;
    for(let x=0;x<W;x+=T){ctx4.beginPath();ctx4.moveTo(x,0);ctx4.lineTo(x,H);ctx4.stroke();}
    for(let y=0;y<H;y+=T){ctx4.beginPath();ctx4.moveTo(0,y);ctx4.lineTo(W,y);ctx4.stroke();}
    // Walls
    walls.forEach(w=>{const wx=w.x*T,wy=w.y*T;const wg=ctx4.createLinearGradient(wx,wy,wx,wy+T);wg.addColorStop(0,'#5b3a1e');wg.addColorStop(1,'#3a2010');ctx4.fillStyle=wg;ctx4.fillRect(wx,wy,T,T);ctx4.strokeStyle='rgba(100,60,20,.5)';ctx4.strokeRect(wx,wy,T,T);});
    // Apple
    apple.glow+=0.1;apple.bounce=Math.sin(apple.glow)*2;
    const ag=ctx4.createRadialGradient(apple.x*T+T/2,apple.y*T+T/2+apple.bounce,2,apple.x*T+T/2,apple.y*T+T/2+apple.bounce,T/2);
    ag.addColorStop(0,'#ff4444');ag.addColorStop(1,'#cc0000');
    ctx4.fillStyle=ag;ctx4.beginPath();ctx4.arc(apple.x*T+T/2,apple.y*T+T/2+apple.bounce,T/2-3,0,Math.PI*2);ctx4.fill();
    ctx4.fillStyle='#22aa22';ctx4.fillRect(apple.x*T+T/2,apple.y*T+apple.bounce,3,T/3);
    // Worm
    worm.forEach((seg,i)=>{
      const t=1-i/worm.length;const isHead=i===0;
      const sg=ctx4.createLinearGradient(seg.x*T,seg.y*T,seg.x*T+T,seg.y*T+T);
      sg.addColorStop(0,isHead?'#88ee44':t>0.5?'#66cc22':'#44aa00');sg.addColorStop(1,isHead?'#55bb11':'#336600');
      ctx4.fillStyle=sg;ctx4.beginPath();ctx4.roundRect(seg.x*T+2,seg.y*T+2,T-4,T-4,isHead?6:3);ctx4.fill();
      if(isHead){ctx4.fillStyle='#fff';ctx4.fillRect(seg.x*T+4+dx3*3,seg.y*T+4+dy3*3,3,3);ctx4.fillRect(seg.x*T+T-7+dx3*3,seg.y*T+4+dy3*3,3,3);}
    });
    if(gameOver4){ctx4.fillStyle='rgba(0,0,0,.75)';ctx4.fillRect(0,0,W,H);ctx4.fillStyle='#ff4444';ctx4.font='bold 26px monospace';ctx4.textAlign='center';ctx4.fillText('GAME OVER',W/2,H/2-15);ctx4.fillStyle='#fff';ctx4.font='14px monospace';ctx4.fillText('Manzanas: '+totalApples,W/2,H/2+12);ctx4.fillStyle='#aaa';ctx4.font='12px monospace';ctx4.fillText('R = reiniciar',W/2,H/2+36);}
    requestAnimationFrame(draw4);
  }
  let lastT5=0;
  function loop5(ts){if(ts-lastT5>130){lastT5=ts;update4();}draw4();}
  initLevel(1);
  const k5=e=>{if(!win.isConnected){document.removeEventListener('keydown',k5);return;}
    if(e.key==='r'||e.key==='R'){gameOver4=false;initLevel(1);dx3=1;dy3=0;ndx3=1;ndy3=0;return;}
    if(e.key==='ArrowLeft'&&dx3===0){ndx3=-1;ndy3=0;e.preventDefault();}if(e.key==='ArrowRight'&&dx3===0){ndx3=1;ndy3=0;e.preventDefault();}
    if(e.key==='ArrowUp'&&dy3===0){ndx3=0;ndy3=-1;e.preventDefault();}if(e.key==='ArrowDown'&&dy3===0){ndx3=0;ndy3=1;e.preventDefault();}
  };
  document.addEventListener('keydown',k5);
  requestAnimationFrame(loop5);
}

/* ── FOOTBALL MASTERS (2 jugadores) ─────────────────────── */
function openFootballMasters(){
  const win=createWindow({title:'Football Masters — 2 Jugadores',icon:'fa-solid fa-futbol',width:700,height:480});
  const content=win.querySelector('.window-content');content.style.padding='0';
  const canvas=document.createElement('canvas');canvas.width=700;canvas.height=440;
  const hud=document.createElement('div');hud.style.cssText='background:#1a3a1a;padding:5px 14px;display:flex;gap:14px;align-items:center;font-family:monospace;font-size:.85rem;color:#fff;flex-shrink:0;';
  hud.innerHTML=`<span style="color:#4fc3f7;font-size:.9rem;font-weight:900;">⚽ J1</span><span id="fm-s1" style="font-size:1.5rem;font-weight:900;color:#4fc3f7;">0</span><span style="flex:1;text-align:center;font-size:.8rem;color:#aaa;" id="fm-time">90s</span><span id="fm-s2" style="font-size:1.5rem;font-weight:900;color:#ffb74d;">0</span><span style="color:#ffb74d;font-size:.9rem;font-weight:900;">J2 ⚽</span>`;
  const info=document.createElement('div');info.style.cssText='background:#1a3a1a;padding:2px 14px;font-family:monospace;font-size:.7rem;color:#666;text-align:center;flex-shrink:0;';
  info.textContent='J1: WASD+Q/E=patada | J2: ↑↓←→+M=patada';
  const wrap=document.createElement('div');wrap.style.cssText='background:#1a3a1a;height:100%;display:flex;flex-direction:column;';
  wrap.appendChild(hud);wrap.appendChild(info);wrap.appendChild(canvas);content.appendChild(wrap);
  const ctx5=canvas.getContext('2d');const W=700,H=440;
  const GOAL_W=14,GOAL_H=100,GOAL_Y=(H-GOAL_H)/2;
  let p1={x:140,y:H/2,vx:0,vy:0,w:22,h:32,score:0,kick:0},p2={x:560,y:H/2,vx:0,vy:0,w:22,h:32,score:0,kick:0};
  let ball={x:W/2,y:H/2,vx:0,vy:0,r:12,spin:0};
  let gameTime=90,lastSec=Date.now(),scored=false,scoreTimer=0,scoreMsg='';
  const keys6={};
  function resetBall(scorer){ball={x:W/2,y:H/2,vx:(scorer===1?-1:1)*2,vy:(Math.random()-.5)*2,r:12,spin:0};scored=false;scoreTimer=0;}
  function kickBall(p){const dx=ball.x-(p.x+p.w/2),dy=ball.y-(p.y+p.h/2);const d=Math.sqrt(dx*dx+dy*dy);if(d<p.w){const power=6+Math.random()*2;ball.vx=dx/d*power;ball.vy=dy/d*power;ball.spin=(Math.random()-.5)*8;}}
  function update5(){
    if(scored){scoreTimer++;if(scoreTimer>80)resetBall(scored);return;}
    const spd=2.8,fric=0.88;
    if(keys6['a'])p1.vx-=spd;if(keys6['d'])p1.vx+=spd;if(keys6['w'])p1.vy-=spd;if(keys6['s'])p1.vy+=spd;
    if(keys6['ArrowLeft'])p2.vx-=spd;if(keys6['ArrowRight'])p2.vx+=spd;if(keys6['ArrowUp'])p2.vy-=spd;if(keys6['ArrowDown'])p2.vy+=spd;
    if((keys6['q']||keys6['Q'])&&!p1.kick){p1.kick=15;kickBall(p1);}if((keys6['e']||keys6['E'])&&!p1.kick){p1.kick=15;kickBall(p1);}
    if(keys6['m']&&!p2.kick){p2.kick=15;kickBall(p2);}
    [p1,p2].forEach(p=>{p.vx*=fric;p.vy*=fric;if(Math.abs(p.vx)>6)p.vx=6*Math.sign(p.vx);if(Math.abs(p.vy)>6)p.vy=6*Math.sign(p.vy);p.x+=p.vx;p.y+=p.vy;p.x=Math.max(0,Math.min(W-p.w,p.x));p.y=Math.max(0,Math.min(H-p.h,p.y));if(p.kick>0)p.kick--;});
    // Ball
    ball.vx*=0.98;ball.vy*=0.98;ball.spin*=0.95;ball.x+=ball.vx;ball.y+=ball.vy;
    if(ball.y-ball.r<0){ball.y=ball.r;ball.vy=Math.abs(ball.vy)*0.7;}
    if(ball.y+ball.r>H){ball.y=H-ball.r;ball.vy=-Math.abs(ball.vy)*0.7;}
    if(ball.x-ball.r<GOAL_W){if(ball.y>GOAL_Y&&ball.y<GOAL_Y+GOAL_H){p2.score++;scored=2;scoreMsg='⚽ GOL! J2 anota!';document.getElementById('fm-s2').textContent=p2.score;}else{ball.x=ball.r+GOAL_W;ball.vx=Math.abs(ball.vx)*0.8;}}
    if(ball.x+ball.r>W-GOAL_W){if(ball.y>GOAL_Y&&ball.y<GOAL_Y+GOAL_H){p1.score++;scored=1;scoreMsg='⚽ GOL! J1 anota!';document.getElementById('fm-s1').textContent=p1.score;}else{ball.x=W-ball.r-GOAL_W;ball.vx=-Math.abs(ball.vx)*0.8;}}
    // Ball-player collision
    [p1,p2].forEach(p=>{const cx=p.x+p.w/2,cy=p.y+p.h/2;const dx=ball.x-cx,dy=ball.y-cy;const d=Math.sqrt(dx*dx+dy*dy);if(d<ball.r+p.w/2){const nx=dx/d,ny=dy/d;ball.vx=nx*5;ball.vy=ny*5;}});
    // Timer
    if(Date.now()-lastSec>1000){gameTime--;lastSec=Date.now();const te=document.getElementById('fm-time');if(te)te.textContent=gameTime+'s';if(gameTime<=0){scored='end';scoreMsg=p1.score>p2.score?'🏆 J1 GANA!':p2.score>p1.score?'🏆 J2 GANA!':'🤝 EMPATE!';}}
  }
  function draw5(){
    if(!win.isConnected)return;
    // Field
    const fg=ctx5.createLinearGradient(0,0,0,H);fg.addColorStop(0,'#2a6e1a');fg.addColorStop(0.5,'#3a8e2a');fg.addColorStop(1,'#2a6e1a');
    ctx5.fillStyle=fg;ctx5.fillRect(0,0,W,H);
    // Field markings
    ctx5.strokeStyle='rgba(255,255,255,.3)';ctx5.lineWidth=2;
    ctx5.beginPath();ctx5.moveTo(W/2,0);ctx5.lineTo(W/2,H);ctx5.stroke();
    ctx5.beginPath();ctx5.arc(W/2,H/2,60,0,Math.PI*2);ctx5.stroke();
    ctx5.beginPath();ctx5.arc(W/2,H/2,3,0,Math.PI*2);ctx5.fillStyle='rgba(255,255,255,.5)';ctx5.fill();
    // Penalty boxes
    ctx5.strokeStyle='rgba(255,255,255,.25)';ctx5.strokeRect(0,GOAL_Y-30,100,GOAL_H+60);ctx5.strokeRect(W-100,GOAL_Y-30,100,GOAL_H+60);
    // Goals
    ctx5.fillStyle='rgba(255,255,255,.9)';ctx5.fillRect(0,GOAL_Y,GOAL_W,GOAL_H);ctx5.fillRect(W-GOAL_W,GOAL_Y,GOAL_W,GOAL_H);
    ctx5.strokeStyle='#ddd';ctx5.lineWidth=2;ctx5.strokeRect(0,GOAL_Y,GOAL_W,GOAL_H);ctx5.strokeRect(W-GOAL_W,GOAL_Y,GOAL_W,GOAL_H);
    // Goal nets
    ctx5.strokeStyle='rgba(200,200,200,.4)';ctx5.lineWidth=1;
    for(let gy=GOAL_Y;gy<GOAL_Y+GOAL_H;gy+=12){ctx5.beginPath();ctx5.moveTo(0,gy);ctx5.lineTo(GOAL_W,gy);ctx5.stroke();ctx5.beginPath();ctx5.moveTo(W-GOAL_W,gy);ctx5.lineTo(W,gy);ctx5.stroke();}
    // Players
    [[p1,'#4fc3f7','J1'],[p2,'#ffb74d','J2']].forEach(([p,col,label])=>{
      const kicking=p.kick>5;
      // Shadow
      ctx5.fillStyle='rgba(0,0,0,.2)';ctx5.beginPath();ctx5.ellipse(p.x+p.w/2,p.y+p.h+2,p.w/2,5,0,0,Math.PI*2);ctx5.fill();
      // Body
      ctx5.fillStyle=col;
      ctx5.beginPath();ctx5.roundRect(p.x,p.y+8,p.w,p.h-8,4);ctx5.fill();
      // Head
      ctx5.fillStyle='#ffc88a';ctx5.beginPath();ctx5.arc(p.x+p.w/2,p.y+6,8,0,Math.PI*2);ctx5.fill();
      // Hair
      ctx5.fillStyle=col;ctx5.fillRect(p.x+4,p.y-2,p.w-8,8);
      // Eyes
      ctx5.fillStyle='#333';ctx5.fillRect(p.x+5,p.y+4,2,2);ctx5.fillRect(p.x+p.w-7,p.y+4,2,2);
      // Kick animation
      if(kicking){ctx5.fillStyle=col;ctx5.save();ctx5.translate(p.x+p.w/2,p.y+p.h-4);ctx5.rotate(0.6*(p===p1?1:-1));ctx5.fillRect(-5,0,10,16);ctx5.fillStyle='#333';ctx5.fillRect(-6,14,12,6);ctx5.restore();}
      else{ctx5.fillStyle=col;ctx5.fillRect(p.x+2,p.y+p.h,8,10);ctx5.fillRect(p.x+p.w-10,p.y+p.h,8,10);ctx5.fillStyle='#333';ctx5.fillRect(p.x+1,p.y+p.h+8,10,5);ctx5.fillRect(p.x+p.w-11,p.y+p.h+8,10,5);}
      // Label
      ctx5.fillStyle='rgba(0,0,0,.5)';ctx5.fillRect(p.x,p.y-15,p.w,10);ctx5.fillStyle='#fff';ctx5.font='8px monospace';ctx5.textAlign='center';ctx5.fillText(label,p.x+p.w/2,p.y-8);
    });
    // Ball
    ball.spin+=0.1;
    ctx5.save();ctx5.translate(ball.x,ball.y);ctx5.rotate(ball.spin);
    ctx5.fillStyle='#fff';ctx5.beginPath();ctx5.arc(0,0,ball.r,0,Math.PI*2);ctx5.fill();
    ctx5.strokeStyle='#333';ctx5.lineWidth=1.5;ctx5.stroke();
    // Ball pattern
    ctx5.fillStyle='#222';ctx5.beginPath();ctx5.arc(0,0,5,0,Math.PI*2);ctx5.fill();
    for(let i=0;i<5;i++){const a=i*(Math.PI*2/5);ctx5.fillRect(Math.cos(a)*7-2,Math.sin(a)*7-2,4,4);}
    ctx5.restore();
    // Score overlay
    if(scored){
      ctx5.fillStyle='rgba(0,0,0,.6)';ctx5.fillRect(W/2-120,H/2-28,240,56);
      ctx5.fillStyle='#FFD700';ctx5.font='bold 22px monospace';ctx5.textAlign='center';ctx5.fillText(scoreMsg,W/2,H/2+6);
    }
    if(gameTime<=0&&scored==='end'){ctx5.fillStyle='rgba(0,0,0,.75)';ctx5.fillRect(0,0,W,H);ctx5.fillStyle='#FFD700';ctx5.font='bold 26px monospace';ctx5.textAlign='center';ctx5.fillText(scoreMsg,W/2,H/2-10);ctx5.fillStyle='#fff';ctx5.font='14px monospace';ctx5.fillText('J1: '+p1.score+' — J2: '+p2.score,W/2,H/2+20);ctx5.fillStyle='#aaa';ctx5.font='12px monospace';ctx5.fillText('R = nueva partida',W/2,H/2+44);}
    update5();requestAnimationFrame(draw5);
  }
  const k6=e=>{if(!win.isConnected){document.removeEventListener('keydown',k6);document.removeEventListener('keyup',k6u);return;}keys6[e.key]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
    if((e.key==='r'||e.key==='R')&&gameTime<=0){p1={x:140,y:H/2,vx:0,vy:0,w:22,h:32,score:0,kick:0};p2={x:560,y:H/2,vx:0,vy:0,w:22,h:32,score:0,kick:0};ball={x:W/2,y:H/2,vx:0,vy:0,r:12,spin:0};gameTime=90;scored=false;document.getElementById('fm-s1').textContent=0;document.getElementById('fm-s2').textContent=0;}
  };
  const k6u=e=>{keys6[e.key]=false;};
  document.addEventListener('keydown',k6);document.addEventListener('keyup',k6u);
  requestAnimationFrame(draw5);
}

/* ── LONGCAT ──────────────────────────────────────────────── */
function openLongcat(){
  const win=createWindow({title:'Longcat',icon:'fa-solid fa-cat',width:520,height:500});
  const content=win.querySelector('.window-content');content.style.padding='0';
  const canvas=document.createElement('canvas');canvas.width=520;canvas.height=460;
  const hud=document.createElement('div');hud.style.cssText='background:#1a1a2e;padding:5px 14px;display:flex;gap:12px;align-items:center;font-family:monospace;font-size:.78rem;color:#fff;flex-shrink:0;';
  hud.innerHTML=`<span style="color:#7fc;font-weight:900;">🐱 LONGCAT</span><span>Altura: <b id="lc-h">0</b>m</span><span>Récord: <b id="lc-rec">0</b>m</span><span style="margin-left:auto;color:#aaa;">← →=mover | ↑/SPACE=saltar</span>`;
  const wrap=document.createElement('div');wrap.style.cssText='background:#0d0d2a;height:100%;display:flex;flex-direction:column;';
  wrap.appendChild(hud);wrap.appendChild(canvas);content.appendChild(wrap);
  const ctx6=canvas.getContext('2d');const W=520,H=460;
  let cat={x:W/2,y:H-80,vx:0,vy:0,w:24,h:44,onGround:false,jump:0,dir:1};
  let platforms2=[{x:0,y:H-30,w:W,h:30,type:'floor'}];
  let score6=0,hiScore2=0,camY2=0,gameOver5=false,startY=H-80;
  let frame6=0;
  for(let i=0;i<20;i++){const py=H-80-i*70-Math.random()*30;const pw=60+Math.random()*80;const px=Math.random()*(W-pw);platforms2.push({x:px,y:py,w:pw,h:14,type:Math.random()<0.2?'move':Math.random()<0.1?'break':'normal',mx:1,range:50,ox:px,broken:false});}
  const keys7={};
  function update6(){
    if(gameOver5)return;
    frame6++;const spd=0.4,fric=0.8,grav=0.45;
    if(keys7['a']||keys7['ArrowLeft']){cat.vx-=spd;cat.dir=-1;}
    if(keys7['d']||keys7['ArrowRight']){cat.vx+=spd;cat.dir=1;}
    if((keys7[' ']||keys7['w']||keys7['ArrowUp'])&&cat.onGround){cat.vy=-12;cat.onGround=false;}
    cat.vx*=fric;if(Math.abs(cat.vx)>6)cat.vx=6*Math.sign(cat.vx);
    cat.vy+=grav;if(cat.vy>15)cat.vy=15;
    cat.x+=cat.vx;cat.y+=cat.vy;
    cat.x=((cat.x%W)+W)%W;
    cat.onGround=false;
    platforms2.forEach(p=>{
      if(p.type==='move'){p.x+=p.mx;if(p.x>p.ox+p.range||p.x<p.ox-p.range)p.mx*=-1;}
      if(!p.broken&&cat.x+cat.w>p.x+2&&cat.x<p.x+p.w-2&&cat.y+cat.h>p.y&&cat.y+cat.h<p.y+18&&cat.vy>=0){
        cat.y=p.y-cat.h;cat.vy=0;cat.onGround=true;
        if(p.type==='break'){p.broken=true;setTimeout(()=>{p.broken=false;},2000);}
      }
    });
    // Camera
    const target=cat.y-H*0.4;if(target<camY2)camY2+=(target-camY2)*0.1;
    // Height score
    const h2=Math.floor((startY-cat.y-camY2)*0.05);if(h2>score6){score6=h2;if(score6>hiScore2)hiScore2=score6;document.getElementById('lc-h').textContent=score6;document.getElementById('lc-rec').textContent=hiScore2;}
    // Fall off bottom
    if(cat.y-camY2>H+50){gameOver5=true;}
    // Generate more platforms
    const topY=camY2;if(platforms2[platforms2.length-1].y>topY-200){
      const py2=platforms2[platforms2.length-1].y-70-Math.random()*30;const pw2=60+Math.random()*80;const px2=Math.random()*(W-pw2);platforms2.push({x:px2,y:py2,w:pw2,h:14,type:Math.random()<0.15?'move':Math.random()<0.08?'break':'normal',mx:1,range:50,ox:px2,broken:false});
    }
  }
  function drawCat6(){
    const cx=cat.x,cy=cat.y-camY2;
    // Tail
    ctx6.strokeStyle='#f5a623';ctx6.lineWidth=5;ctx6.lineCap='round';ctx6.beginPath();ctx6.moveTo(cx+cat.w/2-cat.dir*4,cy+cat.h-8);ctx6.bezierCurveTo(cx-cat.dir*20,cy+cat.h,cx-cat.dir*28,cy+cat.h-16,cx-cat.dir*20,cy+cat.h-26);ctx6.stroke();
    // Body
    ctx6.fillStyle='#f5c842';ctx6.beginPath();ctx6.roundRect(cx,cy,cat.w,cat.h-14,6);ctx6.fill();
    // Head
    ctx6.fillStyle='#f5a623';ctx6.beginPath();ctx6.ellipse(cx+cat.w/2,cy-8,14,12,0,0,Math.PI*2);ctx6.fill();
    // Ears
    ctx6.fillStyle='#f5a623';ctx6.beginPath();ctx6.moveTo(cx+2,cy-16);ctx6.lineTo(cx-2,cy-26);ctx6.lineTo(cx+10,cy-18);ctx6.fill();ctx6.beginPath();ctx6.moveTo(cx+cat.w-2,cy-16);ctx6.lineTo(cx+cat.w+2,cy-26);ctx6.lineTo(cx+cat.w-10,cy-18);ctx6.fill();
    // Eyes
    ctx6.fillStyle='#222';ctx6.beginPath();ctx6.ellipse(cx+6,cy-10,2.5,cat.onGround?2.5:1.5,0,0,Math.PI*2);ctx6.fill();ctx6.beginPath();ctx6.ellipse(cx+cat.w-6,cy-10,2.5,cat.onGround?2.5:1.5,0,0,Math.PI*2);ctx6.fill();
    // Stripes
    ctx6.strokeStyle='rgba(200,140,0,.4)';ctx6.lineWidth=2;
    for(let i=0;i<3;i++){ctx6.beginPath();ctx6.moveTo(cx+4+i*7,cy+8);ctx6.lineTo(cx+4+i*7,cy+cat.h-18);ctx6.stroke();}
    // Legs animated
    const la=Math.sin(frame6*0.3)*5;ctx6.fillStyle='#f5a623';
    ctx6.fillRect(cx+2,cy+cat.h-14,8,14+la);ctx6.fillRect(cx+cat.w-10,cy+cat.h-14,8,14-la);
  }
  function draw6(){
    if(!win.isConnected)return;
    // Sky gradient
    const skyG=ctx6.createLinearGradient(0,0,0,H);skyG.addColorStop(0,'#0d0d2a');skyG.addColorStop(1,'#1a2a4a');
    ctx6.fillStyle=skyG;ctx6.fillRect(0,0,W,H);
    // Stars
    ctx6.fillStyle='rgba(255,255,255,.6)';for(let s=0;s<30;s++)ctx6.fillRect((s*97+camY2*0.02)%W,(s*61+camY2*0.01)%H,1,1);
    // Platforms
    platforms2.forEach(p=>{
      const py=p.y-camY2;if(py<-20||py>H+20)return;
      if(p.broken){ctx6.fillStyle='rgba(150,100,50,.3)';ctx6.fillRect(p.x,py,p.w,p.h);return;}
      const ptype=p.type;const pcol=ptype==='break'?'#cc4422':ptype==='move'?'#2255cc':'#5b3a1e';
      ctx6.fillStyle=pcol;ctx6.fillRect(p.x,py,p.w,p.h);ctx6.fillStyle='rgba(255,255,255,.15)';ctx6.fillRect(p.x,py,p.w,3);
    });
    update6();
    drawCat6();
    // Height meter
    ctx6.fillStyle='rgba(0,0,0,.4)';ctx6.fillRect(W-50,0,50,H);
    ctx6.fillStyle='#7fc';ctx6.fillRect(W-44,H-20-score6*0.3,10,Math.min(score6*0.3,H-30));
    ctx6.fillStyle='#fff';ctx6.font='9px monospace';ctx6.textAlign='center';ctx6.fillText(score6+'m',W-39,H-8);
    if(gameOver5){ctx6.fillStyle='rgba(0,0,0,.8)';ctx6.fillRect(0,0,W,H);ctx6.fillStyle='#7fc';ctx6.font='bold 24px monospace';ctx6.textAlign='center';ctx6.fillText('Caíste!',W/2,H/2-20);ctx6.fillStyle='#fff';ctx6.font='14px monospace';ctx6.fillText('Altura: '+score6+'m',W/2,H/2+8);ctx6.fillStyle='#aaa';ctx6.font='12px monospace';ctx6.fillText('R = reiniciar',W/2,H/2+34);}
    requestAnimationFrame(draw6);
  }
  const k7=e=>{if(!win.isConnected){document.removeEventListener('keydown',k7);document.removeEventListener('keyup',k7u);return;}keys7[e.key]=true;
    if(['ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();
    if((e.key==='r'||e.key==='R')&&gameOver5){cat={x:W/2,y:H-80,vx:0,vy:0,w:24,h:44,onGround:false,jump:0,dir:1};score6=0;camY2=0;startY=H-80;platforms2=[{x:0,y:H-30,w:W,h:30,type:'floor'}];for(let i=0;i<20;i++){const py=H-80-i*70-Math.random()*30;const pw=60+Math.random()*80;const px=Math.random()*(W-pw);platforms2.push({x:px,y:py,w:pw,h:14,type:Math.random()<0.2?'move':Math.random()<0.1?'break':'normal',mx:1,range:50,ox:px,broken:false});}gameOver5=false;}
  };
  const k7u=e=>{keys7[e.key]=false;};
  document.addEventListener('keydown',k7);document.addEventListener('keyup',k7u);
  requestAnimationFrame(draw6);
}

/* ── IRON SNOUT ──────────────────────────────────────────── */
function openIronSnout(){
  const win=createWindow({title:'Iron Snout',icon:'fa-solid fa-hand-back-fist',width:700,height:460});
  const content=win.querySelector('.window-content');content.style.padding='0';
  const canvas=document.createElement('canvas');canvas.width=700;canvas.height=420;
  const hud=document.createElement('div');hud.style.cssText='background:#222;padding:5px 14px;display:flex;gap:14px;align-items:center;font-family:monospace;font-size:.78rem;color:#fff;flex-shrink:0;';
  hud.innerHTML=`<span style="color:#ff9944;font-weight:900;">🐷 IRON SNOUT</span><span>Puntos: <b id="is-score">0</b></span><span>Vidas: <span id="is-lives">❤️❤️❤️</span></span><span style="margin-left:auto;color:#aaa;">← →=esquivar | ↑=saltar | ↓=agachar | WASD=golpear</span>`;
  const wrap=document.createElement('div');wrap.style.cssText='background:#111;height:100%;display:flex;flex-direction:column;';
  wrap.appendChild(hud);wrap.appendChild(canvas);content.appendChild(wrap);
  const ctx7=canvas.getContext('2d');const W=700,H=420;
  let pig={x:W/2,y:H-80,vx:0,vy:0,w:36,h:44,jumping:false,ducking:false,attackDir:'',attackFrame:0,invincible:0,hits:0,lives:3};
  let wolves=[],score7=0,frame7=0,spawnTimer=0,gameOver6=false;
  const keys8={};
  function spawnWolf(){
    const fromLeft=Math.random()<0.5;const wy=H-80-Math.floor(Math.random()*2)*50;
    wolves.push({x:fromLeft?-50:W+50,y:wy,vx:fromLeft?2+score7*0.001:-2-score7*0.001,vy:0,w:32,h:44,alive:true,hitFrame:0,type:Math.random()<0.3?'big':'normal',fromLeft,atkFrame:0});
  }
  function update7(){
    if(gameOver6)return;
    frame7++;spawnTimer++;
    const spawnRate=Math.max(40,120-score7*0.5);
    if(spawnTimer>spawnRate){spawnTimer=0;spawnWolf();if(score7>100&&Math.random()<0.4)spawnWolf();}
    // Pig movement
    const spd=2.5,fric=0.8,grav=0.5,jump=-13;
    if(keys8['ArrowLeft']&&!pig.ducking)pig.vx-=spd;
    if(keys8['ArrowRight']&&!pig.ducking)pig.vx+=spd;
    if((keys8['ArrowUp']||keys8[' '])&&!pig.jumping&&pig.y>=H-80){pig.vy=jump;pig.jumping=true;}
    pig.ducking=!!(keys8['ArrowDown']||keys8['s'])&&pig.y>=H-80;
    pig.vx*=fric;if(Math.abs(pig.vx)>6)pig.vx=6*Math.sign(pig.vx);
    pig.vy+=grav;pig.x+=pig.vx;pig.y+=pig.vy;
    if(pig.y>=H-80){pig.y=H-80;pig.vy=0;pig.jumping=false;}
    pig.x=Math.max(0,Math.min(W-pig.w,pig.x));
    if(pig.invincible>0)pig.invincible--;
    // Attack
    if(keys8['a'])pig.attackDir='left';else if(keys8['d'])pig.attackDir='right';
    else if(keys8['w'])pig.attackDir='up';else if(!keys8['a']&&!keys8['d']&&!keys8['w'])pig.attackDir='';
    if(pig.attackDir)pig.attackFrame=10;else if(pig.attackFrame>0)pig.attackFrame--;
    // Wolves
    wolves=wolves.filter(w=>w.alive&&w.x>-100&&w.x<W+100);
    wolves.forEach(w=>{
      w.x+=w.vx*(w.type==='big'?0.7:1);w.atkFrame++;
      // Wolf attack towards pig
      if(Math.abs(w.x-pig.x)<200)w.vx+=(pig.x-w.x)*0.002*(w.type==='big'?0.5:1);
      if(Math.abs(w.vx)>4+score7*0.002)w.vx=Math.sign(w.vx)*(4+score7*0.002);
      // Pig hits wolf
      if(pig.attackFrame>0&&pig.invincible===0){
        const hitbox={x:pig.x+(pig.attackDir==='right'?pig.w:pig.attackDir==='left'?-40:0),y:pig.y+(pig.attackDir==='up'?-30:pig.attackDir==='down'?pig.h:4),w:40,h:30};
        if(w.x+w.w>hitbox.x&&w.x<hitbox.x+hitbox.w&&w.y+w.h>hitbox.y&&w.y<hitbox.y+hitbox.h){w.hitFrame=20;w.x+=(w.fromLeft?-80:80);w.vx*=-1.5;score7+=w.type==='big'?20:10;document.getElementById('is-score').textContent=score7;}
      }
      // Wolf hits pig
      if(pig.invincible===0&&w.x+w.w>pig.x+4&&w.x<pig.x+pig.w-4&&w.y+w.h>pig.y+4&&w.y<pig.y+pig.h-4){pig.lives--;pig.invincible=90;pig.vx+=w.fromLeft?4:-4;document.getElementById('is-lives').textContent='❤️'.repeat(Math.max(0,pig.lives));if(pig.lives<=0)gameOver6=true;}
      if(w.hitFrame>0)w.hitFrame--;
    });
  }
  function drawPig(){
    const px=pig.x,py=pig.y,dh=pig.ducking?pig.h*0.6:pig.h;
    const flash=pig.invincible>0&&Math.floor(pig.invincible/5)%2===0;
    if(flash)return;
    // Body
    ctx7.fillStyle='#ff99aa';ctx7.beginPath();ctx7.roundRect(px,py+(pig.h-dh),pig.w,dh,8);ctx7.fill();
    // Head
    ctx7.fillStyle='#ffaacc';ctx7.beginPath();ctx7.arc(px+pig.w/2,py,18,0,Math.PI*2);ctx7.fill();
    // Snout
    ctx7.fillStyle='#ff88aa';ctx7.beginPath();ctx7.ellipse(px+pig.w/2,py+10,8,6,0,0,Math.PI*2);ctx7.fill();
    ctx7.fillStyle='#cc4466';ctx7.fillRect(px+pig.w/2-4,py+9,3,3);ctx7.fillRect(px+pig.w/2+1,py+9,3,3);
    // Eyes
    ctx7.fillStyle='#333';ctx7.fillRect(px+6,py-8,4,4);ctx7.fillRect(px+pig.w-10,py-8,4,4);
    // Ears
    ctx7.fillStyle='#ff88aa';ctx7.beginPath();ctx7.moveTo(px+4,py-14);ctx7.lineTo(px-2,py-24);ctx7.lineTo(px+12,py-14);ctx7.fill();ctx7.beginPath();ctx7.moveTo(px+pig.w-4,py-14);ctx7.lineTo(px+pig.w+2,py-24);ctx7.lineTo(px+pig.w-12,py-14);ctx7.fill();
    // Attack effect
    if(pig.attackFrame>0){
      const af=pig.attackFrame/10;const ad=pig.attackDir;
      ctx7.fillStyle=`rgba(255,200,0,${af*0.7})`;
      if(ad==='right')ctx7.fillRect(px+pig.w,py+8,40*af,20);
      else if(ad==='left')ctx7.fillRect(px-40*af,py+8,40*af,20);
      else if(ad==='up')ctx7.fillRect(px+4,py-30*af,pig.w-8,30*af);
      ctx7.font=`${16*af}px serif`;ctx7.textAlign='center';
      if(ad==='right')ctx7.fillText('👊',px+pig.w+20*af,py+22);
      else if(ad==='left')ctx7.fillText('👊',px-20*af,py+22);
      else if(ad==='up')ctx7.fillText('👊',px+pig.w/2,py-15*af);
    }
  }
  function drawWolves(){
    wolves.forEach(w=>{
      const hit=w.hitFrame>0;ctx7.fillStyle=hit?'#fff':(w.type==='big'?'#554433':'#776655');
      ctx7.fillRect(w.x,w.y,w.w,w.h);
      // Wolf head
      ctx7.fillStyle=hit?'#fff':(w.type==='big'?'#443322':'#665544');
      ctx7.fillRect(w.x+(w.fromLeft?w.w-14:-2),w.y-12,16,16);
      // Eyes
      ctx7.fillStyle=hit?'#000':'#f00';ctx7.fillRect(w.x+(w.fromLeft?w.w-10:2),w.y-8,4,4);
      // Mouth
      ctx7.fillStyle='#cc2222';ctx7.fillRect(w.x+(w.fromLeft?w.w-12:0),w.y+2,12,4);
      // Legs
      const la2=Math.sin(frame7*0.2)*4;ctx7.fillStyle=ctx7.fillStyle;ctx7.fillRect(w.x+2,w.y+w.h,8,10+la2);ctx7.fillRect(w.x+w.w-10,w.y+w.h,8,10-la2);
      // Big wolf badge
      if(w.type==='big'){ctx7.fillStyle='#FFD700';ctx7.font='bold 10px sans-serif';ctx7.textAlign='center';ctx7.fillText('BIG',w.x+w.w/2,w.y-15);}
    });
  }
  function draw7(){
    if(!win.isConnected)return;
    // BG
    const bg=ctx7.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#87CEEB');bg.addColorStop(0.6,'#c8e8f8');bg.addColorStop(1,'#7ab36e');
    ctx7.fillStyle=bg;ctx7.fillRect(0,0,W,H);
    // Ground
    ctx7.fillStyle='#7ab36e';ctx7.fillRect(0,H-30,W,30);ctx7.fillStyle='#5a9a4e';ctx7.fillRect(0,H-30,W,6);
    // Clouds background
    ctx7.fillStyle='rgba(255,255,255,.8)';[[80,40,100,30],[250,20,80,25],[420,50,110,28],[580,30,90,26]].forEach(([x,y,w,h2])=>{ctx7.fillRect(x,y,w,h2);ctx7.fillRect(x+10,y-10,w-20,h2);});
    update7();drawWolves();drawPig();
    // Score flash
    if(wolves.some(w=>w.hitFrame>12)){ctx7.fillStyle='rgba(255,255,0,.15)';ctx7.fillRect(0,0,W,H);}
    if(gameOver6){ctx7.fillStyle='rgba(0,0,0,.75)';ctx7.fillRect(0,0,W,H);ctx7.fillStyle='#ff9944';ctx7.font='bold 26px monospace';ctx7.textAlign='center';ctx7.fillText('GAME OVER',W/2,H/2-20);ctx7.fillStyle='#fff';ctx7.font='16px monospace';ctx7.fillText('Puntos: '+score7,W/2,H/2+10);ctx7.fillStyle='#aaa';ctx7.font='12px monospace';ctx7.fillText('R = reiniciar',W/2,H/2+36);}
    requestAnimationFrame(draw7);
  }
  const k8=e=>{if(!win.isConnected){document.removeEventListener('keydown',k8);document.removeEventListener('keyup',k8u);return;}keys8[e.key]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
    if((e.key==='r'||e.key==='R')&&gameOver6){pig={x:W/2,y:H-80,vx:0,vy:0,w:36,h:44,jumping:false,ducking:false,attackDir:'',attackFrame:0,invincible:0,hits:0,lives:3};wolves=[];score7=0;gameOver6=false;document.getElementById('is-score').textContent=0;document.getElementById('is-lives').textContent='❤️❤️❤️';}
  };
  const k8u=e=>{keys8[e.key]=false;};
  document.addEventListener('keydown',k8);document.addEventListener('keyup',k8u);
  requestAnimationFrame(draw7);
}

/* ── SUBWAY SURFERS (runner infinito) ───────────────────── */
function openSubwaySurfers(){
  const win=createWindow({title:'Subway Surfers',icon:'fa-solid fa-person-running',width:400,height:580});
  const content=win.querySelector('.window-content');content.style.padding='0';
  const canvas=document.createElement('canvas');canvas.width=400;canvas.height=540;
  const hud=document.createElement('div');hud.style.cssText='background:#1a1a2e;padding:5px 14px;display:flex;gap:12px;align-items:center;font-family:monospace;font-size:.78rem;color:#fff;flex-shrink:0;';
  hud.innerHTML=`<span style="color:#ffcc00;font-weight:900;">🏃 SUBWAY SURFERS</span><span id="ss-score">0</span><span id="ss-coins" style="color:#FFD700;">🪙 0</span><span style="margin-left:auto;color:#aaa;">← → / A D</span>`;
  const wrap=document.createElement('div');wrap.style.cssText='background:#0a0a1e;height:100%;display:flex;flex-direction:column;';
  wrap.appendChild(hud);wrap.appendChild(canvas);content.appendChild(wrap);
  const ctx8=canvas.getContext('2d');const W=400,H=540;
  const LANES=3,LW=W/LANES;
  let player={lane:1,x:LW*1+LW/2-16,y:H-120,w:32,h:48,vx:0,targetX:LW*1+LW/2-16,roll:0,rollTime:0,invincible:0,frame8:0};
  let obstacles2=[],coins2=[],score8=0,coinCount=0,speed8=4,gameOver7=false,frame8=0;
  let bgY=0,buildings=[];
  for(let i=0;i<8;i++)buildings.push({x:Math.random()*W,y:Math.random()*200,w:20+Math.random()*40,h:80+Math.random()*120});
  function spawnRow(){
    const type=Math.floor(Math.random()*3);// 0=barrier, 1=train, 2=coins
    if(type<2){const lane=Math.floor(Math.random()*LANES);obstacles2.push({x:LW*lane+LW/2-20,y:-60,w:40,h:type===1?80:40,lane,type,frame:0});}
    else{const lane=Math.floor(Math.random()*LANES);for(let i=0;i<3;i++)coins2.push({x:LW*lane+LW/2-8,y:-80-i*40,r:8,collected:false});}
  }
  let spawnT=0;
  function update8(){
    if(gameOver7)return;
    frame8++;score8+=0.05;speed8=4+score8*0.002;spawnT++;
    if(spawnT>Math.max(40,80-score8*0.1)){spawnT=0;spawnRow();}
    // Player move
    player.x+=(player.targetX-player.x)*0.2;
    if(player.invincible>0)player.invincible--;
    if(player.rollTime>0)player.rollTime--;
    // Obstacles
    obstacles2=obstacles2.filter(o=>o.y<H+100);
    obstacles2.forEach(o=>{o.y+=speed8;o.frame++;
      if(player.invincible===0&&player.x+player.w-4>o.x+4&&player.x+4<o.x+o.w-4&&player.y+player.h-4>o.y+4&&player.y+4<o.y+o.h-4){
        if(o.type===1&&player.rollTime>0)return;// roll under train
        gameOver7=true;
      }
    });
    // Coins
    coins2=coins2.filter(c=>c.y<H+50);
    coins2.forEach(c=>{c.y+=speed8;if(!c.collected&&Math.abs(c.x-player.x-player.w/2)<22&&Math.abs(c.y-player.y-player.h/2)<22){c.collected=true;coinCount++;document.getElementById('ss-coins').textContent='🪙 '+coinCount;}});
    document.getElementById('ss-score').textContent=Math.floor(score8);
    bgY=(bgY+speed8*0.3)%H;
  }
  function draw8(){
    if(!win.isConnected)return;
    ctx8.fillStyle='#0a0a1e';ctx8.fillRect(0,0,W,H);
    // Sky & buildings
    ctx8.fillStyle='rgba(20,20,50,.8)';ctx8.fillRect(0,0,W,H*0.5);
    buildings.forEach(b=>{ctx8.fillStyle='rgba(30,30,80,.9)';ctx8.fillRect(b.x,b.y-bgY*0.3,b.w,b.h);ctx8.fillStyle='rgba(255,255,0,.3)';for(let wy=b.y-bgY*0.3+8;wy<b.y+b.h-bgY*0.3;wy+=14)for(let wx=b.x+4;wx<b.x+b.w-4;wx+=10)if(Math.random()<0.01||(wy+wx)%3===0)ctx8.fillRect(wx,wy,6,8);});
    // Ground/tracks
    ctx8.fillStyle='#333';ctx8.fillRect(0,H*0.5,W,H*0.5);
    // Rails
    [[W/3-2,1],[W/3+2,1],[W*2/3-2,1],[W*2/3+2,1],[1,1],[W-3,1]].forEach(([x,_])=>{ctx8.strokeStyle='rgba(150,150,180,.5)';ctx8.lineWidth=3;ctx8.beginPath();ctx8.moveTo(x,H*0.5);ctx8.lineTo(x,H);ctx8.stroke();});
    // Rail ties
    for(let ty=H*0.5+(bgY%30);ty<H;ty+=30){ctx8.fillStyle='rgba(80,50,20,.6)';ctx8.fillRect(0,ty,W,8);}
    // Lane dividers (perspective)
    ctx8.strokeStyle='rgba(255,255,255,.1)';ctx8.lineWidth=1;for(let l=1;l<LANES;l++){ctx8.beginPath();ctx8.moveTo(l*LW,H*0.5);ctx8.lineTo(l*LW,H);ctx8.stroke();}
    update8();
    // Coins
    coins2.forEach(c=>{if(c.collected)return;ctx8.fillStyle='#FFD700';ctx8.beginPath();ctx8.arc(c.x,c.y,c.r,0,Math.PI*2);ctx8.fill();ctx8.fillStyle='#FF8C00';ctx8.beginPath();ctx8.arc(c.x,c.y,c.r-2,0,Math.PI*2);ctx8.fill();ctx8.fillStyle='rgba(255,255,255,.6)';ctx8.fillRect(c.x-3,c.y-c.r+2,3,5);});
    // Obstacles
    obstacles2.forEach(o=>{
      if(o.type===0){// Barrier
        const og=ctx8.createLinearGradient(o.x,o.y,o.x,o.y+o.h);og.addColorStop(0,'#ff4444');og.addColorStop(1,'#cc0000');ctx8.fillStyle=og;ctx8.fillRect(o.x,o.y,o.w,o.h);
        ctx8.fillStyle='rgba(255,255,255,.3)';ctx8.fillRect(o.x,o.y,o.w,4);ctx8.fillStyle='rgba(0,0,0,.3)';ctx8.fillRect(o.x,o.y,4,o.h);
      } else {// Train
        o.frame++;const flash=Math.floor(o.frame/8)%2;ctx8.fillStyle='#aa4444';ctx8.fillRect(o.x-10,o.y,o.w+20,o.h);ctx8.fillStyle='rgba(255,255,255,.15)';for(let wi=0;wi<3;wi++)ctx8.fillRect(o.x+wi*14,o.y+8,10,12);ctx8.fillStyle=flash?'#ffff00':'#ff0000';ctx8.fillRect(o.x,o.y,8,6);
      }
    });
    // Player
    const flash2=player.invincible>0&&Math.floor(player.invincible/5)%2===0;
    if(!flash2){
      const py=player.y,ph=player.rollTime>0?player.h*0.5:player.h;
      // Shadow
      ctx8.fillStyle='rgba(0,0,0,.4)';ctx8.beginPath();ctx8.ellipse(player.x+player.w/2,py+ph+2,player.w/2,6,0,0,Math.PI*2);ctx8.fill();
      // Body - running animation
      const runFrame=Math.floor(frame8*0.2)%4;ctx8.fillStyle='#ff6600';ctx8.fillRect(player.x,py+(player.h-ph),player.w,ph);
      // Head
      ctx8.fillStyle='#ffc88a';ctx8.beginPath();ctx8.arc(player.x+player.w/2,py+(player.h-ph)-10,12,0,Math.PI*2);ctx8.fill();
      // Hair
      ctx8.fillStyle='#8B4513';ctx8.fillRect(player.x+4,py+(player.h-ph)-20,player.w-8,12);
      // Eyes
      ctx8.fillStyle='#333';ctx8.fillRect(player.x+5,py+(player.h-ph)-12,3,3);ctx8.fillRect(player.x+player.w-8,py+(player.h-ph)-12,3,3);
      // Legs animated
      if(player.rollTime<=0){const la3=[6,-6,10,-10][runFrame];ctx8.fillStyle='#cc4400';ctx8.fillRect(player.x+2,py+ph-4,10,16+la3);ctx8.fillRect(player.x+player.w-12,py+ph-4,10,16-la3);}
      // Cap
      ctx8.fillStyle='#FF6600';ctx8.fillRect(player.x+2,py+(player.h-ph)-24,player.w-4,10);
    }
    if(gameOver7){ctx8.fillStyle='rgba(0,0,0,.8)';ctx8.fillRect(0,0,W,H);ctx8.fillStyle='#ff6600';ctx8.font='bold 24px monospace';ctx8.textAlign='center';ctx8.fillText('GAME OVER',W/2,H/2-25);ctx8.fillStyle='#FFD700';ctx8.font='14px monospace';ctx8.fillText('🪙 '+coinCount+' monedas',W/2,H/2+4);ctx8.fillStyle='#fff';ctx8.font='14px monospace';ctx8.fillText('Dist: '+Math.floor(score8)+'m',W/2,H/2+26);ctx8.fillStyle='#aaa';ctx8.font='12px monospace';ctx8.fillText('R = reiniciar',W/2,H/2+52);}
    requestAnimationFrame(draw8);
  }
  const k9=e=>{if(!win.isConnected){document.removeEventListener('keydown',k9);document.removeEventListener('keyup',k9u);return;}
    if((e.key==='ArrowLeft'||e.key==='a')&&player.lane>0){player.lane--;player.targetX=LW*player.lane+LW/2-16;e.preventDefault();}
    if((e.key==='ArrowRight'||e.key==='d')&&player.lane<LANES-1){player.lane++;player.targetX=LW*player.lane+LW/2-16;e.preventDefault();}
    if((e.key==='ArrowDown'||e.key==='s')&&!gameOver7){player.rollTime=40;e.preventDefault();}
    if((e.key==='r'||e.key==='R')&&gameOver7){player={lane:1,x:LW+LW/2-16,y:H-120,vx:0,targetX:LW+LW/2-16,roll:0,rollTime:0,invincible:0,frame8:0};obstacles2=[];coins2=[];score8=0;coinCount=0;speed8=4;gameOver7=false;document.getElementById('ss-coins').textContent='🪙 0';}
  };
  const k9u=e=>{};
  document.addEventListener('keydown',k9);document.addEventListener('keyup',k9u);
  requestAnimationFrame(draw8);
}

/* ── DESCARGA REAL AL PC DEL USUARIO ─────────────────────── */
function downloadFile(filename, content, mimeType){
  mimeType = mimeType || 'text/plain';
  let blob;
  if(content && content.startsWith('data:')){
    // Ya es dataURL
    const a=document.createElement('a');a.href=content;a.download=filename;a.click();
    return;
  }
  blob = new Blob([content||''], {type: mimeType});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

/* ── SUBIDA DE ARCHIVOS DESDE PC ─────────────────────────── */
function initFileDropToDesktop(){
  const desktop = document.getElementById('desktop');
  desktop.addEventListener('dragenter', e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();desktop.classList.add('drop-desktop-active');}});
  desktop.addEventListener('dragover',  e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();});
  desktop.addEventListener('dragleave', e=>{if(!e.relatedTarget||!desktop.contains(e.relatedTarget))desktop.classList.remove('drop-desktop-active');});
  desktop.addEventListener('drop', e=>{
    e.preventDefault();desktop.classList.remove('drop-desktop-active');
    const appAction = e.dataTransfer.getData('app-action');
    if(appAction) return; // es un drag de app, no de archivo externo
    const files = Array.from(e.dataTransfer.files);
    if(!files.length) return;
    const df = findItemById('desktop-folder');
    files.forEach(file=>{
      const reader = new FileReader();
      const ext = file.name.split('.').pop().toLowerCase();
      reader.onload = ev=>{
        const content = ev.target.result; // dataURL
        const item = {id:uid(),type:'file',name:getUniqueName(file.name,df.children),
          ext, content, hidden:false, dateModified:now(), size:file.size};
        df.children.push(item);
        renderDesktop(); saveState();
      };
      reader.readAsDataURL(file);
    });
  });
}

/* ============================================================
   33. INICIALIZACIÓN
   ============================================================ */
document.addEventListener('DOMContentLoaded',()=>{
  loadState();
  renderDesktop();
  startClock();
  renderCalendar();
  updateWifiIcon();
  updateBatteryIcon();
  initSelectionBox();
  initEvents();
  applySystemConfig();
  applyTaskbarRgb(); /* ensure taskbar-rgb class matches sysConfig on load */
  initFileDropToDesktop();
});
