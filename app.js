// Application State
let allBreaches = [];
let filteredBreaches = [];
let currentPage = 1;
const pageSize = 24;

// Track active filter fields
let searchFilter = '';
let yearFilter = 'all';
let sortOrder = 'newest';
let selectedDataFields = new Set();

// Chart instances
let timelineChart = null;
let dataFieldsChart = null;

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  fetchBreaches();
});

// Switch between dashboard and search tabs
function switchTab(tabId) {
  // Update nav buttons active state
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`tab-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Update content active state
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  const activeContent = document.getElementById(`content-${tabId}`);
  if (activeContent) activeContent.classList.add('active');
}

// Fetch compiled breaches dataset
async function fetchBreaches() {
  try {
    const response = await fetch('breaches.json');
    if (!response.ok) {
      throw new Error(`Failed to load breaches data: ${response.statusText}`);
    }
    allBreaches = await response.json();
    filteredBreaches = [...allBreaches];
    
    // Set up stats dashboard UI
    computeStats();
    
    // Initialize sidebar search drop-down filters
    initializeFilters();
    
    // Render the initial Browse Grid page & Dashboard Charts
    renderBrowseGrid();
    initDashboardCharts();
  } catch (error) {
    console.error('Initialization error:', error);
    document.getElementById('breach-grid').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Data Loading Error</div>
        <div class="empty-desc">${error.message}. Please verify breaches.json is compiled and served.</div>
      </div>
    `;
  }
}

// Compute overview ribbon stats
function computeStats() {
  // 1. Total breaches count
  document.getElementById('stat-total-breaches').textContent = allBreaches.length.toLocaleString();
  
  // 2. Compute most exposed data field occurrence
  const fieldCounts = {};
  let mostCommonField = 'None';
  let maxFieldCount = 0;
  
  // 3. Track newest leak date
  let newestYear = 0;
  
  allBreaches.forEach(breach => {
    // Count fields
    if (breach.breached_data) {
      breach.breached_data.forEach(field => {
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
        if (fieldCounts[field] > maxFieldCount) {
          maxFieldCount = fieldCounts[field];
          mostCommonField = field;
        }
      });
    }
    
    // Extract year for newest year check
    if (breach.date) {
      const year = parseInt(breach.date.split('-')[0]);
      if (year && year > newestYear && year <= new Date().getFullYear() + 2) {
        newestYear = year;
      }
    }
  });
  
  // Update DOM values
  document.getElementById('stat-common-field').textContent = mostCommonField;
  document.getElementById('stat-newest-leak').textContent = newestYear || '---';
}

// Build Sidebar year selectors and field check list
function initializeFilters() {
  const years = new Set();
  const dataFields = new Set();
  
  allBreaches.forEach(breach => {
    if (breach.date) {
      const year = breach.date.split('-')[0];
      if (year && year.length === 4) {
        years.add(year);
      }
    }
    if (breach.breached_data) {
      breach.breached_data.forEach(field => dataFields.add(field));
    }
  });
  
  // Populate Years dropdown
  const yearSelect = document.getElementById('filter-year');
  const sortedYears = Array.from(years).sort((a, b) => b - a); // Descending years
  sortedYears.forEach(year => {
    const opt = document.createElement('option');
    opt.value = year;
    opt.textContent = year;
    yearSelect.appendChild(opt);
  });
  
  // Populate Breached Fields list sorted alphabetically
  const filterList = document.getElementById('filter-data-types');
  const sortedFields = Array.from(dataFields).sort();
  
  filterList.innerHTML = ''; // Clear fallback
  sortedFields.forEach(field => {
    const label = document.createElement('label');
    label.className = 'multi-select-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = field;
    checkbox.onchange = (e) => {
      if (e.target.checked) {
        selectedDataFields.add(field);
      } else {
        selectedDataFields.delete(field);
      }
      handleFilterChange();
    };
    
    const labelText = document.createTextNode(` ${field}`);
    
    label.appendChild(checkbox);
    label.appendChild(labelText);
    filterList.appendChild(label);
  });
}

// Run Filters & Sorting pipelines
function applyFilterAndSort() {
  filteredBreaches = allBreaches.filter(breach => {
    // 1. Text Search query filter
    if (searchFilter) {
      const query = searchFilter.toLowerCase();
      const titleMatch = breach.title && breach.title.toLowerCase().includes(query);
      const descMatch = breach.description && breach.description.toLowerCase().includes(query);
      const fieldsMatch = breach.breached_data && breach.breached_data.some(f => f.toLowerCase().includes(query));
      
      if (!titleMatch && !descMatch && !fieldsMatch) {
        return false;
      }
    }
    
    // 2. Year dropdown filter
    if (yearFilter !== 'all') {
      if (!breach.date || !breach.date.startsWith(yearFilter)) {
        return false;
      }
    }
    
    // 3. Multi-select check tags filter (Intersection logic: breach must contain ALL checked elements)
    if (selectedDataFields.size > 0) {
      if (!breach.breached_data) return false;
      for (const field of selectedDataFields) {
        if (!breach.breached_data.includes(field)) {
          return false;
        }
      }
    }
    
    return true;
  });
  
  // 4. Sorting logic
  filteredBreaches.sort((a, b) => {
    if (sortOrder === 'newest') {
      const dateA = a.date || '0000-00-00';
      const dateB = b.date || '0000-00-00';
      return dateB.localeCompare(dateA); // Newest first
    } else if (sortOrder === 'oldest') {
      const dateA = a.date || '9999-99-99';
      const dateB = b.date || '9999-99-99';
      return dateA.localeCompare(dateB); // Oldest first
    } else if (sortOrder === 'az') {
      return (a.title || '').localeCompare(b.title || '');
    } else if (sortOrder === 'za') {
      return (b.title || '').localeCompare(a.title || '');
    } else if (sortOrder === 'fields') {
      const countA = a.breached_data ? a.breached_data.length : 0;
      const countB = b.breached_data ? b.breached_data.length : 0;
      return countB - countA; // Impact (count descending)
    }
    return 0;
  });
  
  currentPage = 1; // Reset to page 1 after filters update
}

// Event Listeners for Filters
function handleSearchInput() {
  searchFilter = document.getElementById('search-input').value.trim();
  handleFilterChange();
}

function handleFilterChange() {
  // Update state values
  yearFilter = document.getElementById('filter-year').value;
  sortOrder = document.getElementById('sort-select').value;
  
  applyFilterAndSort();
  renderBrowseGrid();
}

function resetFilters() {
  // Reset UI components
  document.getElementById('search-input').value = '';
  document.getElementById('filter-year').value = 'all';
  document.getElementById('sort-select').value = 'newest';
  
  // Reset checkboxes
  document.querySelectorAll('#filter-data-types input[type="checkbox"]').forEach(box => {
    box.checked = false;
  });
  
  // Reset State variables
  searchFilter = '';
  yearFilter = 'all';
  sortOrder = 'newest';
  selectedDataFields.clear();
  
  applyFilterAndSort();
  renderBrowseGrid();
}

// Render dynamic card grid
function renderBrowseGrid() {
  const grid = document.getElementById('breach-grid');
  const countLabel = document.getElementById('results-count');
  
  // Update meta results count text
  countLabel.textContent = `Showing ${filteredBreaches.length.toLocaleString()} of ${allBreaches.length.toLocaleString()} breaches`;
  
  if (filteredBreaches.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">No Data Breaches Found</div>
        <div class="empty-desc">We couldn't find any breaches matching your criteria. Try adjusting your search query or reset filters.</div>
      </div>
    `;
    updatePaginationUI(0);
    return;
  }
  
  // Compute indices for pagination bounds
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, filteredBreaches.length);
  const pageItems = filteredBreaches.slice(startIdx, endIdx);
  
  grid.innerHTML = ''; // Clear previous cards
  
  pageItems.forEach(breach => {
    const card = document.createElement('article');
    card.className = 'breach-card';
    card.setAttribute('tabindex', '0');
    card.onclick = () => openModal(breach);
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(breach);
      }
    };
    
    // Extract breach fields for visual preview
    let tagsHTML = '';
    if (breach.breached_data) {
      // Display top 3 tags on cards
      const visibleTags = breach.breached_data.slice(0, 3);
      visibleTags.forEach(field => {
        tagsHTML += `<span class="tag">${field}</span>`;
      });
      if (breach.breached_data.length > 3) {
        tagsHTML += `<span class="tag" style="background: hsla(180, 100%, 45%, 0.1); color: var(--accent-cyan); font-weight:bold;">+${breach.breached_data.length - 3} more</span>`;
      }
    }
    
    // Strip HTML tag markup from description preview for neat card display
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = breach.description || 'No detailed description available.';
    const textDesc = tempDiv.textContent || tempDiv.innerText || '';
    
    card.innerHTML = `
      <div class="card-header">
        <h3 class="card-title">${escapeHTML(breach.title)}</h3>
        <span class="card-date">${escapeHTML(breach.date || 'Unspecified')}</span>
      </div>
      <p class="card-desc">${escapeHTML(textDesc)}</p>
      <div class="card-tags">
        ${tagsHTML}
      </div>
    `;
    
    grid.appendChild(card);
  });
  
  // Update bottom pagination indicators
  const totalPages = Math.ceil(filteredBreaches.length / pageSize);
  updatePaginationUI(totalPages);
}

// Update pagination state UI controls
function updatePaginationUI(totalPages) {
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');
  const indicator = document.getElementById('page-indicator');
  
  if (totalPages <= 1) {
    btnPrev.disabled = true;
    btnNext.disabled = true;
    indicator.textContent = `Page 1 of 1`;
  } else {
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages;
    indicator.textContent = `Page ${currentPage} of ${totalPages}`;
  }
}

// Pagination action clicks
function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderBrowseGrid();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function nextPage() {
  const totalPages = Math.ceil(filteredBreaches.length / pageSize);
  if (currentPage < totalPages) {
    currentPage++;
    renderBrowseGrid();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Modal handling logic
function openModal(breach) {
  const modal = document.getElementById('modal-backdrop');
  
  // Fill text fields
  document.getElementById('modal-title').textContent = breach.title;
  document.getElementById('modal-date').textContent = breach.date || 'Date Unspecified';
  
  // Use innerHTML for description because it contains sanitized anchor tags
  const descContainer = document.getElementById('modal-description');
  descContainer.innerHTML = breach.description || '<p>No description available.</p>';
  
  // Force target="_blank" and secure rel tags on all description links
  descContainer.querySelectorAll('a').forEach(link => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
    link.style.color = 'var(--accent-cyan)';
    link.style.textDecoration = 'underline';
  });
  
  // Populate breached tags
  const tagsContainer = document.getElementById('modal-breached-tags');
  tagsContainer.innerHTML = '';
  if (breach.breached_data && breach.breached_data.length > 0) {
    breach.breached_data.forEach(field => {
      const tag = document.createElement('span');
      tag.className = 'modal-tag';
      tag.textContent = field;
      tagsContainer.appendChild(tag);
    });
  } else {
    tagsContainer.innerHTML = '<span class="text-secondary" style="font-size:0.9rem;">No data fields specified</span>';
  }
  
  // Set Download link info
  const dlButton = document.getElementById('modal-btn-download');
  if (breach.download_link) {
    dlButton.href = breach.download_link;
    dlButton.removeAttribute('disabled');
    dlButton.style.pointerEvents = 'auto';
    dlButton.style.opacity = '1';
  } else {
    dlButton.href = '#';
    dlButton.setAttribute('disabled', 'true');
    dlButton.style.pointerEvents = 'none';
    dlButton.style.opacity = '0.5';
  }
  
  // Show modal
  modal.classList.add('active');
  document.body.style.overflow = 'hidden'; // Stop page scrolling
}

function closeModal() {
  const modal = document.getElementById('modal-backdrop');
  modal.classList.remove('active');
  document.body.style.overflow = ''; // Restore scrolling
}

function closeModalOutside(event) {
  // Close if click target is the backdrop itself
  if (event.target === document.getElementById('modal-backdrop')) {
    closeModal();
  }
}

// Chart.js initialization logic
function initDashboardCharts() {
  // Destroy existing charts to reload clean if called again
  if (timelineChart) timelineChart.destroy();
  if (dataFieldsChart) dataFieldsChart.destroy();
  
  // Parse stats
  const yearsCounts = {};
  const fieldCounts = {};
  
  allBreaches.forEach(breach => {
    if (breach.date) {
      const year = breach.date.split('-')[0];
      if (year && year.length === 4) {
        yearsCounts[year] = (yearsCounts[year] || 0) + 1;
      }
    }
    if (breach.breached_data) {
      breach.breached_data.forEach(field => {
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
      });
    }
  });
  
  // 1. Timeline Chart data parsing
  const sortedYears = Object.keys(yearsCounts).sort();
  const timelineData = sortedYears.map(yr => yearsCounts[yr]);
  
  const ctxTimeline = document.getElementById('chart-timeline').getContext('2d');
  
  // Create gradient fill effect
  const timelineGradient = ctxTimeline.createLinearGradient(0, 0, 0, 300);
  timelineGradient.addColorStop(0, 'rgba(0, 229, 255, 0.4)');
  timelineGradient.addColorStop(1, 'rgba(0, 229, 255, 0.01)');
  
  timelineChart = new Chart(ctxTimeline, {
    type: 'line',
    data: {
      labels: sortedYears,
      datasets: [{
        label: 'Number of Leaks',
        data: timelineData,
        borderColor: '#00e5ff',
        borderWidth: 3,
        pointBackgroundColor: '#00e5ff',
        pointBorderColor: '#00e5ff',
        pointHoverRadius: 7,
        fill: true,
        backgroundColor: timelineGradient,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'hsl(222, 47%, 10%)',
          titleFont: { family: 'Outfit', size: 14, weight: 'bold' },
          bodyFont: { family: 'Outfit', size: 12 },
          borderColor: 'hsla(210, 40%, 80%, 0.1)',
          borderWidth: 1,
          displayColors: false
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'hsl(215, 20%, 65%)', font: { family: 'Outfit' } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'hsl(215, 20%, 65%)', font: { family: 'Outfit' } }
        }
      }
    }
  });
  
  // 2. Data Fields Chart parsing
  const sortedFields = Object.keys(fieldCounts).sort((a, b) => fieldCounts[b] - fieldCounts[a]).slice(0, 10);
  const fieldsData = sortedFields.map(fd => fieldCounts[fd]);
  
  const ctxFields = document.getElementById('chart-data-fields').getContext('2d');
  
  const fieldsGradient = ctxFields.createLinearGradient(0, 0, 400, 0);
  fieldsGradient.addColorStop(0, '#00e5ff');
  fieldsGradient.addColorStop(1, '#00e676');
  
  dataFieldsChart = new Chart(ctxFields, {
    type: 'bar',
    data: {
      labels: sortedFields,
      datasets: [{
        label: 'Exposed in Leaks',
        data: fieldsData,
        backgroundColor: fieldsGradient,
        borderRadius: 6,
        borderWidth: 0,
        barThickness: 16
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'hsl(222, 47%, 10%)',
          titleFont: { family: 'Outfit', size: 14, weight: 'bold' },
          bodyFont: { family: 'Outfit', size: 12 },
          borderColor: 'hsla(210, 40%, 80%, 0.1)',
          borderWidth: 1,
          displayColors: false
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'hsl(215, 20%, 65%)', font: { family: 'Outfit' } }
        },
        y: {
          grid: { display: false },
          ticks: { color: 'hsl(210, 40%, 96%)', font: { family: 'Outfit', size: 12 } }
        }
      }
    }
  });
}

// Helpers
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
