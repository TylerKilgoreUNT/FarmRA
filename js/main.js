document.addEventListener('DOMContentLoaded', function(){
	// Active state for secondary panel buttons
	document.querySelectorAll('.side-btn').forEach(btn => {
		btn.addEventListener('click', function(){
			document.querySelectorAll('.side-btn').forEach(b=>b.classList.remove('active'));
			btn.classList.add('active');
			const action = btn.dataset.action;
			console.log('left-panel action:', action);
		});
	});

	// Active state for icon column buttons (toggle highlight)
	document.querySelectorAll('.icon-btn').forEach(btn => {
		btn.addEventListener('click', function(){
			document.querySelectorAll('.icon-btn').forEach(b=>b.classList.remove('active'));
			btn.classList.add('active');
			const action = btn.dataset.action;
			console.log('icon action:', action);
			// Optionally trigger corresponding action in left-panel (if desired)
		});
	});
});
