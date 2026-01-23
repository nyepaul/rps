/**
 * Users by Location Report Component
 * Shows which users access the system from which locations with security alerts
 */

import { apiClient } from '../../api/client.js';
import { showLogDetails, showIPLocationsMap, showIPListView } from './logs-viewer.js';

/**
 * Render the users-by-location report
 */
export async function renderUsersByLocationReport(container) {
    container.innerHTML = `
        <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h2 style="margin: 0; font-size: 20px;">👥 Users by Location Report</h2>
                    <p style="margin: 5px 0 0 0; color: var(--text-secondary); font-size: 14px;">
                        Analyze user access patterns and detect potential security issues
                    </p>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <select id="report-period" style="padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="7">Last 7 days</option>
                        <option value="30" selected>Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="180">Last 180 days</option>
                        <option value="365">Last year</option>
                    </select>
                    <button id="view-list-report-btn" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-weight: 600;">
                        📋 View List
                    </button>
                    <button id="view-map-report-btn" style="padding: 8px 16px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-weight: 600;">
                        🗺️ View Map
                    </button>
                    <button id="refresh-report-btn" style="padding: 8px 16px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        🔄 Refresh
                    </button>
                    <button id="export-report-btn" style="padding: 8px 16px; background: var(--success-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        📥 Export CSV
                    </button>
                </div>
            </div>

            <div id="report-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <!-- Summary cards will be inserted here -->
            </div>

            <div style="background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color); overflow: hidden;">
                <div style="display: flex; gap: 10px; padding: 15px; border-bottom: 1px solid var(--border-color); background: var(--bg-primary);">
                    <input type="text" id="search-users" placeholder="🔍 Search users..." style="flex: 1; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);">
                    <select id="filter-security" style="padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);">
                        <option value="all">All Users</option>
                        <option value="flagged">With Security Flags</option>
                        <option value="multiple">Multiple Locations</option>
                    </select>
                </div>

                <div id="report-content" style="min-height: 400px;">
                    <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: var(--text-secondary);">
                        <div style="text-align: center;">
                            <div style="font-size: 48px; margin-bottom: 10px;">📊</div>
                            <div>Loading report...</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Event listeners
    document.getElementById('view-map-report-btn').addEventListener('click', () => {
        const period = document.getElementById('report-period').value;
        showIPLocationsMap(period);
    });
    document.getElementById('view-list-report-btn').addEventListener('click', () => {
        const period = document.getElementById('report-period').value;
        showIPListView(period);
    });
    document.getElementById('refresh-report-btn').addEventListener('click', () => loadReport(container));
    document.getElementById('report-period').addEventListener('change', () => loadReport(container));
    document.getElementById('export-report-btn').addEventListener('click', () => exportReport());
    document.getElementById('search-users').addEventListener('input', filterUsers);
    document.getElementById('filter-security').addEventListener('change', filterUsers);

    // Load initial report
    await loadReport(container);
}

let currentReportData = null;
let currentUserMap = null;

// Listen for theme changes
window.addEventListener('themeChanged', () => {
    if (currentUserMap) {
        const isDarkMode = document.body.classList.contains('dark-mode') || document.body.classList.contains('high-contrast-mode');
        const tileLayerUrl = isDarkMode 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
            
        currentUserMap.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                layer.setUrl(tileLayerUrl);
            }
        });
    }
});

/**
 * Load the users-by-location report
 */
async function loadReport(container) {
    const contentDiv = document.getElementById('report-content');
    const summaryDiv = document.getElementById('report-summary');
    const period = document.getElementById('report-period').value;

    try {
        const response = await apiClient.get(`/api/admin/reports/users-by-location?days=${period}`);
        currentReportData = response;

        // Render summary
        renderSummary(summaryDiv, response.summary);

        // Render user table
        renderUserTable(contentDiv, response.users);

    } catch (error) {
        console.error('Failed to load report:', error);
        contentDiv.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 400px;">
                <div style="text-align: center; color: var(--danger-color);">
                    <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
                    <div>Failed to load report: ${error.message}</div>
                </div>
            </div>
        `;
    }
}

/**
 * Render summary statistics
 */
function renderSummary(container, summary) {
    const cards = [
        {
            icon: '👥',
            label: 'Total Users',
            value: summary.total_users,
            color: 'var(--accent-color)',
            clickable: true
        },
        {
            icon: '🌐',
            label: 'Unique IP Addresses',
            value: summary.unique_ip_addresses || 0,
            color: 'var(--info-color)',
            clickable: true
        },
        {
            icon: '📍',
            label: 'Total Locations',
            value: summary.total_locations,
            color: 'var(--success-color)',
            clickable: true
        },
        {
            icon: '🔀',
            label: 'Multi-Location Users',
            value: summary.users_with_multiple_locations,
            color: 'var(--warning-color)',
            clickable: false
        },
        {
            icon: '⚠️',
            label: 'Security Flags',
            value: summary.users_with_security_flags,
            color: 'var(--danger-color)',
            clickable: false
        }
    ];

    container.innerHTML = cards.map((card, index) => `
        <div class="summary-card" data-index="${index}" style="background: var(--bg-primary); padding: 20px; border-radius: 8px; border: 1px solid var(--border-color); border-left: 4px solid ${card.color}; ${card.clickable ? 'cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;' : ''}"
            ${card.clickable ? `onmouseenter="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseleave="this.style.transform='translateY(0)'; this.style.boxShadow='none'"` : ''}
        >
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="font-size: 32px;">${card.icon}</div>
                <div>
                    <div style="font-size: 28px; font-weight: 700; color: ${card.color};">${card.value}</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${card.label}</div>
                </div>
            </div>
        </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.summary-card').forEach(el => {
        const index = parseInt(el.dataset.index);
        if (cards[index].clickable) {
            el.addEventListener('click', () => {
                const period = document.getElementById('report-period').value;
                showIPLocationsMap(period);
            });
        }
    });
}

/**
 * Render user table with locations
 */
function renderUserTable(container, users) {
    if (!users || users.length === 0) {
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: var(--text-secondary);">
                <div style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
                    <div>No user activity found for this period</div>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="overflow-x: auto;">
            <table id="users-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--bg-primary); border-bottom: 2px solid var(--border-color);">
                        <th style="padding: 12px; text-align: left; font-weight: 600;">User</th>
                        <th style="padding: 12px; text-align: center; font-weight: 600;">Locations</th>
                        <th style="padding: 12px; text-align: center; font-weight: 600;">IPs</th>
                        <th style="padding: 12px; text-align: center; font-weight: 600;">Accesses</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600;">Last Seen</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600;">Security</th>
                        <th style="padding: 12px; text-align: center; font-weight: 600;">Actions</th>
                    </tr>
                </thead>
                <tbody id="users-table-body">
                    ${users.map(renderUserRow).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Render a single user row
 */
function renderUserRow(user) {
    const lastSeen = new Date(user.last_seen);
    const relativeTime = getRelativeTime(lastSeen);
    const userJson = JSON.stringify(user).replace(/'/g, "&#39;");

    const securityBadges = user.security_flags.map(flag => {
        const color = flag.severity === 'high' ? 'var(--danger-color)' :
                      flag.severity === 'medium' ? 'var(--warning-color)' :
                      'var(--info-color)';

        return `<span style="display: inline-block; padding: 2px 8px; background: ${color}20; color: ${color}; border-radius: 4px; font-size: 11px; margin-right: 4px;" title="${flag.message}">
            ${flag.type.replace(/_/g, ' ')}
        </span>`;
    }).join('');

    return `
        <tr class="user-row" data-user='${userJson}' data-username="${user.username.toLowerCase()}" data-security-flags="${user.security_flags.length}" data-locations="${user.unique_locations}" style="border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='transparent'">
            <td style="padding: 12px;">
                <div style="font-weight: 600; color: var(--text-primary);">${user.username}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">${user.email}</div>
                ${!user.is_active ? '<span style="display: inline-block; padding: 2px 6px; background: var(--danger-color)20; color: var(--danger-color); border-radius: 4px; font-size: 10px; margin-top: 4px;">INACTIVE</span>' : ''}
            </td>
            <td style="padding: 12px; text-align: center;">
                <span style="font-weight: 700; font-size: 18px; color: ${user.unique_locations > 5 ? 'var(--warning-color)' : 'var(--success-color)'};">
                    ${user.unique_locations}
                </span>
            </td>
            <td style="padding: 12px; text-align: center;">
                <span style="font-weight: 600; color: var(--text-secondary);">${user.unique_ips}</span>
            </td>
            <td style="padding: 12px; text-align: center;">
                <span style="font-weight: 600; color: var(--text-secondary);">${user.total_accesses.toLocaleString()}</span>
            </td>
            <td style="padding: 12px;">
                <div style="font-size: 13px;">${lastSeen.toLocaleDateString()}</div>
                <div style="font-size: 11px; color: var(--text-secondary);">${relativeTime}</div>
            </td>
            <td style="padding: 12px;">
                ${user.security_flags.length > 0 ? securityBadges : '<span style="color: var(--success-color);">✓ No Flags</span>'}
            </td>
            <td style="padding: 12px; text-align: center;">
                <button class="view-details-btn" style="padding: 6px 12px; background: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                    View Details
                </button>
            </td>
        </tr>
    `;
}

/**
 * Get relative time string
 */
function getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
}

// Event delegation for user rows and view details buttons
document.addEventListener('click', (e) => {
    const row = e.target.closest('.user-row');
    if (row) {
        try {
            const userData = JSON.parse(row.getAttribute('data-user'));
            showUserDetails(userData);
        } catch (error) {
            console.error('Error parsing user data:', error);
        }
    }
});

/**
 * Show user details modal with map
 */
function showUserDetails(user) {
    const modal = document.createElement('div');
    modal.className = 'user-details-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; width: 90%; max-width: 1200px; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px;">
                <div>
                    <h2 style="margin: 0; font-size: 20px;">👤 ${user.username}</h2>
                    <p style="margin: 5px 0 0 0; color: var(--text-secondary); font-size: 14px;">${user.email}</p>
                </div>
                <button class="close-modal-btn" style="background: transparent; border: none; font-size: 28px; cursor: pointer; color: var(--text-secondary); padding: 0; line-height: 1;">×</button>
            </div>

            ${user.security_flags.length > 0 ? `
                <div style="margin-bottom: 20px; padding: 15px; background: var(--danger-color)10; border-left: 4px solid var(--danger-color); border-radius: 6px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 16px; color: var(--danger-color);">⚠️ Security Alerts</h3>
                    ${user.security_flags.map(flag => `
                        <div style="margin-bottom: 8px; padding: 8px; background: var(--bg-secondary); border-radius: 4px;">
                            <span style="font-weight: 600; text-transform: uppercase; font-size: 11px; color: ${flag.severity === 'high' ? 'var(--danger-color)' : 'var(--warning-color)'};">
                                ${flag.severity}
                            </span>
                            <div style="margin-top: 4px; font-size: 13px;">${flag.message}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <div id="user-location-map" style="height: 400px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); margin-bottom: 20px;"></div>

            <h3 style="margin: 0 0 15px 0; font-size: 16px;">📍 Location Details</h3>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--bg-primary); border-bottom: 2px solid var(--border-color);">
                            <th style="padding: 10px; text-align: left; font-weight: 600;">Location</th>
                            <th style="padding: 10px; text-align: left; font-weight: 600;">IP Address</th>
                            <th style="padding: 10px; text-align: center; font-weight: 600;">Accesses</th>
                            <th style="padding: 10px; text-align: left; font-weight: 600;">First Seen</th>
                            <th style="padding: 10px; text-align: left; font-weight: 600;">Last Seen</th>
                        </tr>
                    </thead>
                    <tbody id="user-location-table-body">
                        ${user.locations.map(location => `
                            <tr class="location-drilldown-row" data-ip="${location.ip_address}" data-user-id="${user.user_id}" data-city="${location.city}" data-country="${location.country}" style="border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='transparent'">
                                <td style="padding: 10px;">
                                    <div style="font-weight: 600;">${location.city}</div>
                                    <div style="font-size: 12px; color: var(--text-secondary);">${location.region}, ${location.country}</div>
                                </td>
                                <td style="padding: 10px; font-family: monospace; font-size: 13px;">${location.ip_address}</td>
                                <td style="padding: 10px; text-align: center; font-weight: 600; color: var(--accent-color);">${location.access_count}</td>
                                <td style="padding: 10px; font-size: 13px;">${new Date(location.first_access).toLocaleString()}</td>
                                <td style="padding: 10px; font-size: 13px;">${new Date(location.last_access).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 20px; text-align: center;">
                <button class="close-modal-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    Close
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Setup close handlers
    modal.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentUserMap) {
                currentUserMap.remove();
                currentUserMap = null;
            }
            modal.remove();
        });
    });

    // Handle row clicks for drilldown
    modal.querySelectorAll('.location-drilldown-row').forEach(row => {
        row.addEventListener('click', (e) => {
            const ip = row.dataset.ip;
            const userId = row.dataset.userId;
            const city = row.dataset.city;
            const country = row.dataset.country;
            showIPLogs(userId, ip, city, country);
        });
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            if (currentUserMap) {
                currentUserMap.remove();
                currentUserMap = null;
            }
            modal.remove();
        }
    });

    // Initialize map
    setTimeout(() => {
        const mapContainer = document.getElementById('user-location-map');
        if (mapContainer && typeof L !== 'undefined') {
            try {
                // Calculate bounds
                const lats = user.locations.map(loc => loc.lat);
                const lons = user.locations.map(loc => loc.lon);
                const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
                const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;

                currentUserMap = L.map('user-location-map').setView([centerLat, centerLon], 4);

                const isDarkMode = document.body.classList.contains('dark-mode') || document.body.classList.contains('high-contrast-mode');
                const tileLayerUrl = isDarkMode 
                    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

                L.tileLayer(tileLayerUrl, {
                    attribution: '© OpenStreetMap contributors © CARTO',
                    maxZoom: 19,
                    crossOrigin: true
                }).addTo(currentUserMap);

                // Add markers
                const markers = user.locations.map(location => {
                    const markerSize = Math.max(10, Math.min(24, 10 + (location.access_count / Math.max(...user.locations.map(l => l.access_count)) * 14)));

                    const customIcon = L.divIcon({
                        className: 'custom-marker',
                        html: `<div style="background: var(--accent-color); width: ${markerSize}px; height: ${markerSize}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                        iconSize: [markerSize, markerSize],
                        iconAnchor: [markerSize / 2, markerSize / 2]
                    });

                    const marker = L.marker([location.lat, location.lon], { icon: customIcon }).addTo(currentUserMap);

                    marker.bindPopup(`
                        <div style="text-align: center; padding: 8px; min-width: 200px;">
                            <div style="font-size: 14px; font-weight: 700; margin-bottom: 4px;">${location.city}</div>
                            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">${location.region}, ${location.country}</div>
                            <div style="font-size: 11px; font-family: monospace; margin-bottom: 8px; color: #888;">${location.ip_address}</div>
                            <button class="map-access-drilldown-btn" data-ip="${location.ip_address}" data-user-id="${user.user_id}" data-city="${location.city}" data-country="${location.country}" 
                                style="width: 100%; border: none; font-size: 11px; padding: 6px 8px; background: var(--accent-color); border-radius: 4px; color: white; font-weight: 600; cursor: pointer;">
                                📋 ${location.access_count} access${location.access_count !== 1 ? 'es' : ''} (View Logs)
                            </button>
                        </div>
                    `);

                    // Add click handler for button inside popup
                    marker.on('popupopen', () => {
                        const btn = document.querySelector('.map-access-drilldown-btn');
                        if (btn) {
                            btn.addEventListener('click', () => {
                                showIPLogs(btn.dataset.userId, btn.dataset.ip, btn.dataset.city, btn.dataset.country);
                            });
                        }
                    });

                    return marker;
                });

                // Fit map to show all markers
                if (markers.length > 0) {
                    const group = L.featureGroup(markers);
                    currentUserMap.fitBounds(group.getBounds().pad(0.1));
                }

            } catch (error) {
                console.error('Failed to initialize map:', error);
                mapContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--danger-color);">Failed to load map</div>';
            }
        }
    }, 100);
}

/**
 * Filter users based on search and security filter
 */
function filterUsers() {
    const searchTerm = document.getElementById('search-users').value.toLowerCase();
    const securityFilter = document.getElementById('filter-security').value;
    const rows = document.querySelectorAll('.user-row');

    rows.forEach(row => {
        const username = row.getAttribute('data-username');
        const securityFlags = parseInt(row.getAttribute('data-security-flags'));
        const locations = parseInt(row.getAttribute('data-locations'));

        let matchesSearch = username.includes(searchTerm);
        let matchesSecurity = true;

        if (securityFilter === 'flagged') {
            matchesSecurity = securityFlags > 0;
        } else if (securityFilter === 'multiple') {
            matchesSecurity = locations > 1;
        }

        row.style.display = (matchesSearch && matchesSecurity) ? '' : 'none';
    });
}

/**
 * Export report to CSV
 */
function exportReport() {
    if (!currentReportData) {
        alert('No report data to export');
        return;
    }

    const csv = generateCSV(currentReportData.users);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-by-location-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

/**
 * Generate CSV from report data
 */
function generateCSV(users) {
    const headers = ['Username', 'Email', 'Locations', 'IPs', 'Total Accesses', 'Last Seen', 'Security Flags'];
    const rows = users.map(user => [
        user.username,
        user.email,
        user.unique_locations,
        user.unique_ips,
        user.total_accesses,
        user.last_seen,
        user.security_flags.map(f => f.type).join('; ')
    ]);

    return [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
}

/**
 * Show detailed access logs for a specific IP and User
 */
async function showIPLogs(userId, ipAddress, city, country) {
    const modal = document.createElement('div');
    modal.className = 'ip-logs-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    modal.innerHTML = `
        <div style="background: var(--bg-secondary); padding: 30px; border-radius: 12px; width: 95%; max-width: 1000px; max-height: 90vh; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid var(--border-color); padding-bottom: 15px;">
                <div>
                    <h2 style="margin: 0; font-size: 20px;">📋 Access Logs for ${ipAddress}</h2>
                    <p style="margin: 5px 0 0 0; color: var(--text-secondary); font-size: 14px;">${city}, ${country}</p>
                </div>
                <button class="close-logs-btn" style="background: transparent; border: none; font-size: 28px; cursor: pointer; color: var(--text-secondary); padding: 0; line-height: 1;">×</button>
            </div>

            <div id="ip-logs-container" style="flex: 1; overflow-y: auto; min-height: 300px;"></div>

            <div style="margin-top: 20px; text-align: center;">
                <button class="close-logs-btn" style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    Close
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Setup close handlers
    modal.querySelectorAll('.close-logs-btn').forEach(btn => {
        btn.addEventListener('click', () => modal.remove());
    });

    try {
        const params = new URLSearchParams({
            user_id: userId,
            ip_address: ipAddress,
            limit: 500
        });

        const data = await apiClient.get(`/api/admin/logs?${params.toString()}`);
        const logs = data.logs || [];
        const container = modal.querySelector('#ip-logs-container');

        if (logs.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-secondary);">No matching logs found.</p>';
            return;
        }

        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: var(--bg-primary); border-bottom: 2px solid var(--border-color); position: sticky; top: 0; z-index: 1;">
                        <th style="padding: 10px; text-align: left; font-weight: 600;">Time</th>
                        <th style="padding: 10px; text-align: left; font-weight: 600;">Action</th>
                        <th style="padding: 10px; text-align: left; font-weight: 600;">Description</th>
                        <th style="padding: 10px; text-align: left; font-weight: 600;">Device</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(log => {
                        const date = new Date(log.created_at);
                        const dev = log.device_info || {};
                        
                        // Determine a good description
                        let description = log.details?._description || '';
                        if (!description) {
                            if (log.action === 'NETWORK_ACCESS' && log.request_endpoint) {
                                description = `${log.request_method || 'GET'} ${log.request_endpoint}`;
                            } else if (log.table_name) {
                                description = `${log.action} on ${log.table_name}`;
                                if (log.record_id) description += ` (#${log.record_id})`;
                            } else {
                                description = log.action;
                            }
                        }

                        return `
                            <tr class="log-drilldown-row" data-id="${log.id}" style="border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='transparent'">
                                <td style="padding: 10px; white-space: nowrap;">
                                    <div>${date.toLocaleDateString()}</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">${date.toLocaleTimeString()}</div>
                                </td>
                                <td style="padding: 10px;">
                                    <span style="display: inline-block; padding: 2px 6px; background: var(--accent-color)15; color: var(--accent-color); border-radius: 4px; font-size: 11px; font-weight: 600;">
                                        ${log.action}
                                    </span>
                                </td>
                                <td style="padding: 10px;">
                                    <div style="font-size: 13px; color: var(--text-primary); line-height: 1.4;">${description}</div>
                                    ${log.table_name ? `<div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">Table: ${log.table_name}</div>` : ''}
                                </td>
                                <td style="padding: 10px; font-size: 11px; color: var(--text-secondary);">
                                    ${dev.browser || 'Unknown'} on ${dev.os || 'Unknown'}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        // Add click handlers for log rows
        container.querySelectorAll('.log-drilldown-row').forEach(row => {
            row.addEventListener('click', () => {
                showLogDetails(row.dataset.id);
            });
        });

    } catch (error) {
        console.error('Failed to load IP logs:', error);
        modal.querySelector('#ip-logs-container').innerHTML = `<div style="color: var(--danger-color); padding: 20px;">Error: ${error.message}</div>`;
    }
}
