/* DRAFTED APPAREL — shared site JS (motion + UI) */

// Mobile nav
(function(){ var t=document.getElementById('navToggle'),m=document.getElementById('mobileMenu');
  if(t&&m) t.addEventListener('click',function(){ m.classList.toggle('open'); }); })();

// Scroll reveals (single elements + staggered groups)
function bindReveal(){
  var obs=new IntersectionObserver(function(es){ es.forEach(function(e){
    if(e.isIntersecting){ e.target.classList.add('in');
      if(e.target.hasAttribute('data-stagger')){
        Array.prototype.forEach.call(e.target.children,function(c,i){ c.style.transitionDelay=(i*90)+'ms'; });
      }
      obs.unobserve(e.target); }
  }); },{threshold:.08,rootMargin:'0px 0px -28px 0px'});
  document.querySelectorAll('.reveal:not(.in), [data-stagger]:not(.in), .img-zoom:not(.in)')
    .forEach(function(el){ obs.observe(el); });
}
document.addEventListener('DOMContentLoaded', bindReveal);

// Parallax: <el data-parallax="0.18"> moves at fraction of scroll
(function(){
  var els=[]; 
  function collect(){ els=Array.prototype.slice.call(document.querySelectorAll('[data-parallax]')); }
  function tick(){
    var y=window.scrollY;
    els.forEach(function(el){
      var f=parseFloat(el.getAttribute('data-parallax'))||.15;
      var r=el.getBoundingClientRect();
      if(r.bottom>0 && r.top<innerHeight) el.style.transform='translateY('+(y*f*-1)+'px) scale(1.08)';
    });
    requestAnimationFrame(tick);
  }
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.addEventListener('DOMContentLoaded',function(){ collect(); tick(); });
  }
})();

// Count/price ticker: animate numeric content changes
function tickTo(el, target, prefix, decimals){
  prefix=prefix||''; decimals=decimals==null?2:decimals;
  var start=parseFloat((el.textContent||'0').replace(/[^0-9.]/g,''))||0;
  var t0=performance.now(), dur=420;
  function step(t){ var p=Math.min(1,(t-t0)/dur); p=1-Math.pow(1-p,3);
    el.textContent=prefix+(start+(target-start)*p).toFixed(decimals);
    if(p<1) requestAnimationFrame(step); }
  requestAnimationFrame(step);
}

// Toast
function toast(msg){
  var el=document.querySelector('.toast'); if(!el){ el=document.createElement('div'); el.className='toast'; document.body.appendChild(el); }
  el.textContent=msg; el.classList.add('show');
  clearTimeout(el._t); el._t=setTimeout(function(){ el.classList.remove('show'); },3200);
}
