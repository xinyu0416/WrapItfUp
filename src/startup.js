/* End-of-document boot barrier: no legacy editor is exposed during startup. */
(function(){
 const show=()=>{
  const status=document.getElementById('wiu-boot-status');
  if(!window.WIUWorkspaceTools||!window.__WIU_ASSEMBLY__||!document.querySelector('.a-shell .ux-home, .a-shell main, .a-shell section, .a-shell h1')){
   status.textContent='WrapItfUp 載入未完成。請重新開啟網頁；離線版請確認 HTML 下載完整。';status.setAttribute('role','alert');return;
  }
  document.body.removeAttribute('data-wiu-boot');status.remove();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(show),{once:true});else requestAnimationFrame(show);
})();
