let currentLanguage="python";
let currentFile="main";
let files={
  main:{name:"main.py",content:'# Welcome to Code Sandbox\n# Real Python execution runs in your browser.\n\nname = "Jake"\nprint(f"Hello, {name}!")\n\nfor i in range(3):\n    print("Count:", i)'}
};
let fileCounter=1;
let editor=null;
let pyodide=null;
let pyodideLoading=null;
let isRunning=false;
let runToken=0;
let lumenExpanded=false;
let sidebarWidth=218;
let terminalHeight=180;

document.addEventListener("DOMContentLoaded",async()=>{
  editor=CodeMirror.fromTextArea(document.getElementById("code-editor"),{
    mode:"python",theme:"dracula",lineNumbers:true,autoCloseBrackets:true,
    matchBrackets:true,indentUnit:4,tabSize:4,lineWrapping:false,
    extraKeys:{"Ctrl-Space":"autocomplete","Ctrl-Enter":()=>runCode(),"Ctrl-S":()=>saveCurrent()}
  });
  editor.setValue(files.main.content);
  editor.on("change",()=>{
    if(!files[currentFile]) return;
    files[currentFile].content=editor.getValue();
    document.getElementById("unsaved").classList.add("show");
  });
  updateFileList();
  setRuntime("loading","Loading Python runtime…");
  await loadPython();
  setupResizeHandlers();
  showWelcomeModal();
});

async function loadPython(){
  try{
    pyodideLoading=loadPyodide();
    pyodide=await pyodideLoading;
    setRuntime("ready","Python ready");
    addToTerminal("Python runtime ready — WebAssembly execution enabled.","success");
  }catch(e){
    setRuntime("error","Python failed to load");
    addToTerminal("Could not load Python runtime: "+e.message,"error");
  }
}
function setRuntime(state,text){
  const dot=document.getElementById("runtime-dot");
  dot.className="status-dot "+(state==="ready"?"ready":"");
  if(state==="error") dot.style.background="var(--danger)";
  document.getElementById("runtime-status").textContent=text;
  document.getElementById("side-runtime-detail").textContent=state==="ready"?"Made By Jake":"Loading…";
}
function updateFileList(){
  const list=document.getElementById("file-list"); list.innerHTML="";
  Object.keys(files).forEach(id=>{
    const el=document.createElement("div");
    el.className="file-item "+(id===currentFile?"active":"");
    el.onclick=()=>switchFile(id);
    el.innerHTML=`<span class="file-dot">●</span><span>${escapeHtml(files[id].name)}</span>`;
    if(Object.keys(files).length>1){
      const x=document.createElement("span");x.className="file-close";x.textContent="×";
      x.onclick=e=>{e.stopPropagation();closeFile(id)};el.appendChild(x);
    }
    list.appendChild(el);
  });
  document.getElementById("active-file-name").textContent=files[currentFile].name;
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function selectLanguage(lang){
  if(lang===currentLanguage)return;
  if(lang==="cpp"){
    addToTerminal("C++ is editor-only for now. Browser execution is enabled for Python.","info");
    return;
  }
  currentLanguage=lang;
  document.querySelectorAll(".lang-tab").forEach(b=>b.classList.toggle("active",b.dataset.lang===lang));
  editor.setOption("mode","python"); document.getElementById("side-runtime").textContent="Python";
}
function addNewFile(){
  fileCounter++;
  const id="file"+fileCounter;
  files[id]={name:`file${fileCounter}.py`,content:"# New Python file\n\nprint(\"Hello from a new file!\")"};
  switchFile(id);
}
function switchFile(id){
  if(!files[id])return;
  files[currentFile].content=editor.getValue();currentFile=id;editor.setValue(files[id].content);
  document.getElementById("unsaved").classList.remove("show");updateFileList();
}
function closeFile(id){
  if(Object.keys(files).length<=1){addToTerminal("You can't close the last file.","error");return}
  delete files[id];currentFile=Object.keys(files)[0];editor.setValue(files[currentFile].content);updateFileList();
}
function saveCurrent(){
  files[currentFile].content=editor.getValue();
  document.getElementById("unsaved").classList.remove("show");
  addToTerminal(`${files[currentFile].name} saved locally in this session.`,"info");
}
function downloadCurrentFile(){
  saveCurrent();
  const blob=new Blob([files[currentFile].content],{type:"text/plain"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=files[currentFile].name;a.click();
  URL.revokeObjectURL(a.href);
}
function clearEditor(){editor.setValue("");editor.focus()}
function formatHint(){addToTerminal("Tip: Python formatting is intentionally left untouched so your code stays exactly as written.","info")}
function addToTerminal(message,type=""){
  const out=document.getElementById("terminal-output");
  const line=document.createElement("div");line.className="terminal-line "+type;line.textContent=message;
  out.appendChild(line);out.scrollTop=out.scrollHeight;
}
function clearTerminal(){
  document.getElementById("terminal-output").innerHTML="";
  addToTerminal("Terminal cleared","info");
}
async function compileCode(){
  const code=editor.getValue();
  if(currentLanguage!=="python"){addToTerminal("Compilation is currently available for Python.","error");return}
  try{
    if(window.pyodide){
      pyodide.runPython("compile("+JSON.stringify(code)+", '<editor>', 'exec')");
      addToTerminal("Syntax check passed. Compiling to executable...","success");

      const filename=files[currentFile].name.replace(".py","");
      addToTerminal("Sending code to compilation service...","info");

      setTimeout(async()=>{
        try{
          const response=await fetch("https://lumen.baby/api/compile",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({code,filename,language:"python"})
          });

          if(response.ok){
            const blob=await response.blob();
            const a=document.createElement("a");
            a.href=URL.createObjectURL(blob);
            a.download=filename+".exe";
            a.click();
            URL.revokeObjectURL(a.href);
            addToTerminal(`Executable ${filename}.exe downloaded successfully!`,"success");
          }else{
            addToTerminal("Compilation service unavailable. Downloading Python script instead.","info");
            const pyBlob=new Blob([code],{type:"text/plain"});
            const a=document.createElement("a");
            a.href=URL.createObjectURL(pyBlob);
            a.download=files[currentFile].name;
            a.click();
            URL.revokeObjectURL(a.href);
          }
        }catch(e){
          addToTerminal("Compilation service unavailable. Downloading Python script instead.","info");
          const pyBlob=new Blob([code],{type:"text/plain"});
          const a=document.createElement("a");
          a.href=URL.createObjectURL(pyBlob);
          a.download=files[currentFile].name;
          a.click();
          URL.revokeObjectURL(a.href);
        }
      },2000);
    }else addToTerminal("Python runtime is still loading.","info");
  }catch(e){addToTerminal(formatPythonError(e),"error")}
}
async function runCode(){
  if(isRunning){addToTerminal("Code is already running.","error");return}
  if(currentLanguage!=="python"){addToTerminal("Only Python has a real browser runtime right now.","error");return}
  if(!pyodide){addToTerminal("Python is still loading — try again in a moment.","info");return}
  isRunning=true;const token=++runToken;
  document.getElementById("run-button").disabled=true;
  document.getElementById("run-message").textContent="Running…";
  document.getElementById("terminal-badge").textContent="RUNNING";
  addToTerminal("Running code…","info");
  const code=editor.getValue();
  try{
    pyodide.setStdout({batched:(msg)=>{if(token===runToken)addToTerminal(msg,"output")}});
    pyodide.setStderr({batched:(msg)=>{if(token===runToken)addToTerminal(msg,"error")}});
    await pyodide.runPythonAsync(code);
    if(token===runToken)addToTerminal("Execution completed.","success");
  }catch(e){
    if(token===runToken)addToTerminal(formatPythonError(e),"error");
  }finally{
    pyodide.setStdout({batched:()=>{}});
    pyodide.setStderr({batched:()=>{}});
    isRunning=false;document.getElementById("run-button").disabled=false;
    document.getElementById("run-message").textContent="Ready";
    document.getElementById("terminal-badge").textContent="READY";
  }
}
function stopCode(){
  if(!isRunning){addToTerminal("No code is currently running.","error");return}
  runToken++;isRunning=false;
  document.getElementById("run-button").disabled=false;
  document.getElementById("run-message").textContent="Stopped";
  document.getElementById("terminal-badge").textContent="READY";
  addToTerminal("Execution stopped. Note: browser Python cannot forcibly kill every synchronous operation.","error");
}
function formatPythonError(e){
  return String(e?.message||e).replace(/^PythonError:\s*/,"");
}
function openBgModal(){document.getElementById("bg-modal").classList.add("active")}
function closeBgModal(){document.getElementById("bg-modal").classList.remove("active")}
function setBackground(theme){
  document.body.className=theme==="dark"?"":"theme-"+theme;
  localStorage.setItem("sandbox-theme",theme);closeBgModal();
}
const savedTheme=localStorage.getItem("sandbox-theme");if(savedTheme)setBackground(savedTheme);
window.addEventListener("keydown",e=>{
  if(e.key==="Escape"){closeBgModal();closeWelcomeModal()}
});

function setupResizeHandlers(){
  const sidebarResize=document.getElementById("sidebar-resize");
  const terminalResize=document.getElementById("terminal-resize");
  const sidebar=document.getElementById("sidebar");
  const terminalCard=document.getElementById("terminal-card");
  const workspace=document.querySelector(".workspace");

  let isResizingSidebar=false;
  let isResizingTerminal=false;

  sidebarResize.addEventListener("mousedown",(e)=>{
    isResizingSidebar=true;
    e.preventDefault();
  });

  terminalResize.addEventListener("mousedown",(e)=>{
    isResizingTerminal=true;
    e.preventDefault();
  });

  document.addEventListener("mousemove",(e)=>{
    if(isResizingSidebar){
      const newWidth=e.clientX;
      if(newWidth>=150&&newWidth<=400){
        sidebarWidth=newWidth;
        workspace.style.gridTemplateColumns=`${newWidth}px minmax(0,1fr) ${lumenExpanded?"300px":"0px"}`;
      }
    }
    if(isResizingTerminal){
      const newHeight=terminalCard.offsetHeight+(e.movementY);
      if(newHeight>=180&&newHeight<=500){
        terminalHeight=newHeight;
        terminalCard.style.height=`${newHeight}px`;
        const terminalOutput=document.querySelector(".terminal-output");
        terminalOutput.style.height=`${newHeight-38}px`;
      }
    }
  });

  document.addEventListener("mouseup",()=>{
    isResizingSidebar=false;
    isResizingTerminal=false;
  });
}

function toggleLumen(){
  lumenExpanded=!lumenExpanded;
  const lumenPanel=document.getElementById("lumen-panel");
  const workspace=document.querySelector(".workspace");
  const lumenArrow=document.getElementById("lumen-arrow");

  if(lumenExpanded){
    lumenPanel.classList.remove("collapsed");
    workspace.style.gridTemplateColumns=`${sidebarWidth}px minmax(0,1fr) 300px`;
    lumenArrow.textContent="◀";
  }else{
    lumenPanel.classList.add("collapsed");
    workspace.style.gridTemplateColumns=`${sidebarWidth}px minmax(0,1fr) 0px`;
    lumenArrow.textContent="▶";
  }
}

function saveLumenApiKey(){
  const apiKey=document.getElementById("lumen-api-key").value;
  const status=document.getElementById("lumen-status");

  if(!apiKey.trim()){
    status.textContent="Please enter an API key";
    status.className="lumen-status error";
    return;
  }

  localStorage.setItem("lumen-api-key",apiKey);
  status.textContent="API key saved! Redirecting to backend...";
  status.className="lumen-status success";

  setTimeout(()=>{
    window.open("https://lumen.baby/api/redirect","_blank");
  },1000);
}

function showWelcomeModal(){
  const welcomeShown=localStorage.getItem("welcome-shown");
  if(!welcomeShown){
    document.getElementById("welcome-modal").classList.add("active");
    localStorage.setItem("welcome-shown","true");
  }
}

function closeWelcomeModal(){
  document.getElementById("welcome-modal").classList.remove("active");
}

function setBackground(theme){
  document.body.className=theme==="dark"?"":"theme-"+theme;
  localStorage.setItem("sandbox-theme",theme);
  closeBgModal();

  const root=document.documentElement;
  if(theme==="dark"){
    root.style.setProperty("--bg","#080a0d");
    root.style.setProperty("--panel","#101318");
    root.style.setProperty("--panel2","#0c0f13");
  }else if(theme==="black"){
    root.style.setProperty("--bg","#000000");
    root.style.setProperty("--panel","#0a0a0a");
    root.style.setProperty("--panel2","#050505");
  }else if(theme==="blue"){
    root.style.setProperty("--bg","#071221");
    root.style.setProperty("--panel","#0d1a2b");
    root.style.setProperty("--panel2","#0b1725");
  }else if(theme==="purple"){
    root.style.setProperty("--bg","#0e0818");
    root.style.setProperty("--panel","#171024");
    root.style.setProperty("--panel2","#120c1d");
  }else if(theme==="light"){
    root.style.setProperty("--bg","#eef1f4");
    root.style.setProperty("--panel","#fff");
    root.style.setProperty("--panel2","#f7f8fa");
  }
}
