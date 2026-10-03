/* BalletWeb — site-wide language selector.
 * Uses the Google Translate engine for complete-page translation while keeping
 * English as the source language. The selected language is remembered locally.
 */
(function () {
  'use strict';
  var LANGS = [
    ['en','English'],['es','Español'],['fr','Français'],['de','Deutsch'],['pt','Português'],
    ['it','Italiano'],['ja','日本語'],['ko','한국어'],['zh-CN','简体中文'],['ar','العربية']
  ];
  function ensureStyles(){
    if(document.getElementById('ballet-language-style')) return;
    var s=document.createElement('style'); s.id='ballet-language-style';
    s.textContent='#ballet-language{position:relative;margin-left:4px}#ballet-language select{appearance:none;background:#fff;border:1px solid #dfe2e7;border-radius:8px;padding:9px 30px 9px 11px;font:700 12px Inter,system-ui,sans-serif;color:#15171a;cursor:pointer}#ballet-language:after{content:"⌄";position:absolute;right:11px;top:7px;pointer-events:none;color:#667085}.goog-te-banner-frame,.goog-te-balloon-frame{display:none!important}body{top:0!important}.goog-text-highlight{background:transparent!important;box-shadow:none!important}@media(max-width:850px){#ballet-language{margin:8px 20px 12px}#ballet-language select{width:100%}}';
    document.head.appendChild(s);
  }
  function mount(){
    if(document.getElementById('ballet-language')) return;
    ensureStyles();
    var host=document.createElement('div'); host.id='ballet-language'; host.setAttribute('aria-label','Language selector');
    var select=document.createElement('select'); select.id='ballet-language-select'; select.title='Language';
    LANGS.forEach(function(x){var o=document.createElement('option');o.value=x[0];o.textContent=x[1];select.appendChild(o)});
    host.appendChild(select);
    var nav=document.querySelector('.navin');
    if(nav){var links=nav.querySelector('.links'); if(links) links.parentNode.insertBefore(host,links); else nav.appendChild(host)}
    else document.body.insertBefore(host,document.body.firstChild);
    var saved=localStorage.getItem('ballet-language')||'en'; select.value=saved;
    select.addEventListener('change',function(){
      var lang=select.value; localStorage.setItem('ballet-language',lang);
      if(lang==='en'){document.cookie='googtrans=/en/en;path=/'; location.reload(); return;}
      document.cookie='googtrans=/en/'+lang+';path=/';
      if(window.google&&google.translate&&google.translate.TranslateElement){apply(lang)} else {loadGoogle(function(){apply(lang)})}
    });
    if(saved!=='en') loadGoogle(function(){apply(saved)});
  }
  function loadGoogle(cb){
    window.__balletGoogleTranslateReady=window.__balletGoogleTranslateReady||[]; window.__balletGoogleTranslateReady.push(cb);
    if(document.getElementById('google-translate-script')) return;
    var holder=document.createElement('div'); holder.id='google_translate_element'; holder.style.display='none'; document.body.appendChild(holder);
    window.googleTranslateElementInit=function(){
      new google.translate.TranslateElement({pageLanguage:'en',includedLanguages:LANGS.map(function(x){return x[0]}).join(','),autoDisplay:false},'google_translate_element');
      var q=window.__balletGoogleTranslateReady.splice(0); q.forEach(function(fn){fn()});
    };
    var s=document.createElement('script');s.id='google-translate-script';s.src='https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';s.async=true;document.head.appendChild(s);
  }
  function apply(lang){
    var combo=document.querySelector('.goog-te-combo');
    if(combo){combo.value=lang;combo.dispatchEvent(new Event('change'));}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
