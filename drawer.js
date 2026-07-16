/* FIX V12 — Menú móvil off-canvas (solo UI, no altera lógica de negocio) */
(function(){
  var sidebar = document.querySelector('.sidebar');
  var menuBtn = document.getElementById('mobileMenuBtn');
  var overlay = document.getElementById('mobileOverlay');
  if(!sidebar || !menuBtn || !overlay) return;

  function openDrawer(){
    sidebar.classList.add('open');
    overlay.classList.add('open');
    menuBtn.setAttribute('aria-expanded','true');
  }
  function closeDrawer(){
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    menuBtn.setAttribute('aria-expanded','false');
  }

  menuBtn.addEventListener('click', function(){
    if(sidebar.classList.contains('open')){ closeDrawer(); } else { openDrawer(); }
  });
  overlay.addEventListener('click', closeDrawer);
  sidebar.querySelectorAll('.nav button').forEach(function(btn){
    btn.addEventListener('click', closeDrawer);
  });
  window.addEventListener('resize', function(){
    if(window.innerWidth > 720){ closeDrawer(); }
  });
})();
