document.addEventListener('DOMContentLoaded', function(){
    // User menu functionality
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    
    if(userMenuBtn && userDropdown) {
        // Toggle menu on button click
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.hidden = !userDropdown.hidden;
            userMenuBtn.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if(!userDropdown.hidden && !userDropdown.contains(e.target)) {
                userDropdown.hidden = true;
                userMenuBtn.classList.remove('active');
            }
        });

        // Handle menu item clicks
        userDropdown.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const action = e.currentTarget.textContent.trim().toLowerCase();
                
                switch(action) {
                    case 'account info':
                        console.log('Show account info');
                        // TODO: Implement account info view
                        break;
                    case 'change password':
                        console.log('Show password change');
                        // TODO: Implement password change
                        break;
                    case 'log out':
                        console.log('Logging out');
                        // TODO: Implement logout
                        break;
                }

                // Close menu after action
                userDropdown.hidden = true;
                userMenuBtn.classList.remove('active');
            });
        });
    }

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
	// Bind only to the left-narrow buttons (buttons are used for sensor toggles)
	document.querySelectorAll('#left-narrow button.icon-btn').forEach(btn => {
		btn.addEventListener('click', function(){
			document.querySelectorAll('#left-narrow .icon-btn').forEach(b=>b.classList.remove('active'));
			btn.classList.add('active');
			const action = btn.dataset.action;
			console.log('icon action:', action);
			// render the selected sensor/dashboard
			renderSensor(action);
		});
	});

	// Determine which icon should be active on load based on the current page
	let desiredAction = 'all';
	const path = window.location.pathname || '';
	if(path.endsWith('/map.html') || path.endsWith('map.html')){
		desiredAction = 'map';
	}

	// Clear any previous active state and set the desired one (works for buttons and anchors)
	document.querySelectorAll('#left-narrow .icon-btn').forEach(b=>b.classList.remove('active'));
	const sel = document.querySelector(`#left-narrow .icon-btn[data-action="${desiredAction}"]`);
	if(sel) sel.classList.add('active');

	// Initial render: attempt to render the corresponding sensor view (noop if no grafana-flex)
	renderSensor(desiredAction === 'map' ? 'all' : desiredAction);
});

/*
 * Dynamic renderer for grafana content.
 * - 'all' shows the original 3-panel layout (full + two halves)
 * - 'light' | 'moisture' | 'temperature' show a single full-width panel
 *
 * You can customize the URLs in `sensorUrls` to point to specific Grafana panels.
 */
function renderSensor(sensor){
	const container = document.querySelector('.grafana-flex');
	if(!container) return;

	// Try to use an existing iframe src as a base; fallback to a placeholder
	const firstIframe = document.querySelector('.grafana-flex iframe');
	const baseSrc = firstIframe ? firstIframe.src : '';

	// Customize per-sensor URLs here. By default we append a variable so you can
	// use templated dashboards in Grafana (update as needed).
	const sensorUrls = {
		all: baseSrc,
		light: baseSrc ? (baseSrc + '&var-sensor=light') : '',
		moisture: baseSrc ? (baseSrc + '&var-sensor=moisture') : '',
		temperature: baseSrc ? (baseSrc + '&var-sensor=temperature') : '',
	};

	// Build HTML for the different layouts
	if(sensor === 'all' || !sensor){
		container.innerHTML = `
			<div class="grafanaContainer grafanaContainer-full">
				<iframe src="${sensorUrls.all}" width="100%" height="400px" frameborder="0" title="Grafana Panel 1"></iframe>
			</div>
			<div class="grafana-half-row">
				<div class="grafanaContainer grafanaContainer-half">
					<iframe src="${sensorUrls.all}" width="100%" height="400px" frameborder="0" title="Grafana Panel 2"></iframe>
				</div>
				<div class="grafanaContainer grafanaContainer-half">
					<iframe src="${sensorUrls.all}" width="100%" height="400px" frameborder="0" title="Grafana Panel 3"></iframe>
				</div>
			</div>
		`;
	} else {
		// single full-width panel for the selected sensor
		const src = sensorUrls[sensor] || baseSrc;
		container.innerHTML = `
			<div class="grafanaContainer grafanaContainer-full">
				<iframe src="${src}" width="100%" height="600px" frameborder="0" title="${sensor} panel"></iframe>
			</div>
		`;
	}

	// Re-attach any behaviors if needed (none required at the moment)
}
