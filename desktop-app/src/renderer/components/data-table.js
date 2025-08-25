/**
 * Data Table Component
 * Advanced data table with sorting, filtering, pagination
 */

class DataTable {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.data = [];
        this.filteredData = [];
        this.currentPage = 1;
        this.pageSize = options.pageSize || 10;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.searchTerm = '';
        this.filters = {};
        
        this.options = {
            searchable: true,
            sortable: true,
            paginated: true,
            selectable: false,
            exportable: false,
            ...options
        };
        
        this.columns = options.columns || [];
        this.selectedRows = new Set();
        this.callbacks = {
            onRowClick: options.onRowClick || null,
            onSelectionChange: options.onSelectionChange || null,
            onSort: options.onSort || null
        };
        
        this.init();
    }

    init() {
        if (!this.container) {
            console.error('Container not found:', this.containerId);
            return;
        }
        
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        this.container.className = 'data-table-container';
        
        // Create table structure
        const wrapper = document.createElement('div');
        wrapper.className = 'data-table-wrapper';
        
        // Header controls
        if (this.options.searchable || this.options.exportable) {
            wrapper.appendChild(this.createControls());
        }
        
        // Table
        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-container';
        tableContainer.appendChild(this.createTable());
        wrapper.appendChild(tableContainer);
        
        // Footer
        if (this.options.paginated || this.options.selectable) {
            wrapper.appendChild(this.createFooter());
        }
        
        this.container.appendChild(wrapper);
        this.updateDisplay();
    }

    createControls() {
        const controls = document.createElement('div');
        controls.className = 'table-controls';
        
        const leftControls = document.createElement('div');
        leftControls.className = 'table-controls-left';
        
        const rightControls = document.createElement('div');
        rightControls.className = 'table-controls-right';
        
        // Search input
        if (this.options.searchable) {
            const searchGroup = document.createElement('div');
            searchGroup.className = 'search-group';
            searchGroup.innerHTML = `
                <i class="fas fa-search"></i>
                <input type="text" id="${this.containerId}-search" placeholder="Search..." class="search-input">
            `;
            leftControls.appendChild(searchGroup);
            
            // Search event listener
            const searchInput = searchGroup.querySelector('input');
            searchInput.addEventListener('input', (e) => {
                this.search(e.target.value);
            });
        }
        
        // Export button
        if (this.options.exportable) {
            const exportBtn = document.createElement('button');
            exportBtn.className = 'btn btn-secondary btn-sm';
            exportBtn.innerHTML = '<i class="fas fa-download"></i> Export';
            exportBtn.addEventListener('click', () => this.exportData());
            rightControls.appendChild(exportBtn);
        }
        
        // Refresh button
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'btn btn-secondary btn-sm';
        refreshBtn.innerHTML = '<i class="fas fa-refresh"></i>';
        refreshBtn.title = 'Refresh';
        refreshBtn.addEventListener('click', () => this.refresh());
        rightControls.appendChild(refreshBtn);
        
        controls.appendChild(leftControls);
        controls.appendChild(rightControls);
        
        return controls;
    }

    createTable() {
        const table = document.createElement('table');
        table.className = 'table';
        
        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Selection column
        if (this.options.selectable) {
            const selectCell = document.createElement('th');
            selectCell.className = 'select-column';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.addEventListener('change', (e) => this.toggleAllSelection(e.target.checked));
            selectCell.appendChild(checkbox);
            headerRow.appendChild(selectCell);
        }
        
        // Data columns
        this.columns.forEach(column => {
            const th = document.createElement('th');
            th.className = 'table-header';
            
            if (column.sortable !== false && this.options.sortable) {
                th.className += ' sortable';
                th.addEventListener('click', () => this.sort(column.key));
            }
            
            const headerContent = document.createElement('div');
            headerContent.className = 'header-content';
            headerContent.innerHTML = `
                <span class="header-text">${column.title}</span>
                ${column.sortable !== false && this.options.sortable ? '<i class="fas fa-sort sort-icon"></i>' : ''}
            `;
            
            th.appendChild(headerContent);
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Body
        const tbody = document.createElement('tbody');
        tbody.id = `${this.containerId}-tbody`;
        table.appendChild(tbody);
        
        return table;
    }

    createFooter() {
        const footer = document.createElement('div');
        footer.className = 'table-footer';
        
        const leftFooter = document.createElement('div');
        leftFooter.className = 'table-footer-left';
        
        const rightFooter = document.createElement('div');
        rightFooter.className = 'table-footer-right';
        
        // Selection info
        if (this.options.selectable) {
            const selectionInfo = document.createElement('div');
            selectionInfo.className = 'selection-info';
            selectionInfo.id = `${this.containerId}-selection`;
            leftFooter.appendChild(selectionInfo);
        }
        
        // Pagination
        if (this.options.paginated) {
            const pagination = document.createElement('div');
            pagination.className = 'pagination';
            pagination.id = `${this.containerId}-pagination`;
            rightFooter.appendChild(pagination);
        }
        
        footer.appendChild(leftFooter);
        footer.appendChild(rightFooter);
        
        return footer;
    }

    setData(data) {
        this.data = Array.isArray(data) ? data : [];
        this.filterAndSort();
        this.updateDisplay();
    }

    addRow(rowData) {
        this.data.push(rowData);
        this.filterAndSort();
        this.updateDisplay();
    }

    updateRow(index, rowData) {
        if (index >= 0 && index < this.data.length) {
            this.data[index] = { ...this.data[index], ...rowData };
            this.filterAndSort();
            this.updateDisplay();
        }
    }

    removeRow(index) {
        if (index >= 0 && index < this.data.length) {
            this.data.splice(index, 1);
            this.filterAndSort();
            this.updateDisplay();
        }
    }

    search(term) {
        this.searchTerm = term.toLowerCase();
        this.currentPage = 1;
        this.filterAndSort();
        this.updateDisplay();
    }

    filter(columnKey, value) {
        if (value === null || value === undefined || value === '') {
            delete this.filters[columnKey];
        } else {
            this.filters[columnKey] = value;
        }
        this.currentPage = 1;
        this.filterAndSort();
        this.updateDisplay();
    }

    sort(columnKey) {
        if (this.sortColumn === columnKey) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = columnKey;
            this.sortDirection = 'asc';
        }
        
        this.filterAndSort();
        this.updateDisplay();
        this.updateSortIcons();
        
        if (this.callbacks.onSort) {
            this.callbacks.onSort(columnKey, this.sortDirection);
        }
    }

    filterAndSort() {
        let filtered = [...this.data];
        
        // Apply search
        if (this.searchTerm) {
            filtered = filtered.filter(row => {
                return this.columns.some(column => {
                    const value = this.getCellValue(row, column);
                    return String(value).toLowerCase().includes(this.searchTerm);
                });
            });
        }
        
        // Apply filters
        Object.keys(this.filters).forEach(columnKey => {
            const filterValue = this.filters[columnKey];
            filtered = filtered.filter(row => {
                const cellValue = row[columnKey];
                return String(cellValue).toLowerCase().includes(String(filterValue).toLowerCase());
            });
        });
        
        // Apply sorting
        if (this.sortColumn) {
            const column = this.columns.find(col => col.key === this.sortColumn);
            filtered.sort((a, b) => {
                const aVal = this.getCellValue(a, column);
                const bVal = this.getCellValue(b, column);
                
                let comparison = 0;
                if (column.type === 'number') {
                    comparison = Number(aVal) - Number(bVal);
                } else if (column.type === 'date') {
                    comparison = new Date(aVal) - new Date(bVal);
                } else {
                    comparison = String(aVal).localeCompare(String(bVal));
                }
                
                return this.sortDirection === 'desc' ? -comparison : comparison;
            });
        }
        
        this.filteredData = filtered;
    }

    updateDisplay() {
        this.updateTableBody();
        this.updatePagination();
        this.updateSelectionInfo();
    }

    updateTableBody() {
        const tbody = document.getElementById(`${this.containerId}-tbody`);
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (this.filteredData.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = this.columns.length + (this.options.selectable ? 1 : 0);
            cell.className = 'empty-state';
            cell.innerHTML = '<div class="empty-message"><i class="fas fa-inbox"></i><p>No data available</p></div>';
            row.appendChild(cell);
            tbody.appendChild(row);
            return;
        }
        
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = this.options.paginated ? 
            Math.min(startIndex + this.pageSize, this.filteredData.length) : 
            this.filteredData.length;
        
        for (let i = startIndex; i < endIndex; i++) {
            const rowData = this.filteredData[i];
            const row = this.createTableRow(rowData, i);
            tbody.appendChild(row);
        }
    }

    createTableRow(rowData, index) {
        const row = document.createElement('tr');
        row.className = 'table-row';
        row.dataset.index = index;
        
        // Selection column
        if (this.options.selectable) {
            const selectCell = document.createElement('td');
            selectCell.className = 'select-column';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = this.selectedRows.has(index);
            checkbox.addEventListener('change', (e) => this.toggleRowSelection(index, e.target.checked));
            selectCell.appendChild(checkbox);
            row.appendChild(selectCell);
        }
        
        // Data columns
        this.columns.forEach(column => {
            const cell = document.createElement('td');
            cell.className = 'table-cell';
            
            const value = this.getCellValue(rowData, column);
            cell.innerHTML = this.formatCellValue(value, column);
            
            if (column.className) {
                cell.classList.add(column.className);
            }
            
            row.appendChild(cell);
        });
        
        // Row click handler
        if (this.callbacks.onRowClick) {
            row.style.cursor = 'pointer';
            row.addEventListener('click', (e) => {
                if (!e.target.closest('input[type="checkbox"]')) {
                    this.callbacks.onRowClick(rowData, index);
                }
            });
        }
        
        return row;
    }

    getCellValue(rowData, column) {
        if (column.render) {
            return column.render(rowData);
        }
        
        const keys = column.key.split('.');
        let value = rowData;
        for (const key of keys) {
            value = value?.[key];
        }
        
        return value;
    }

    formatCellValue(value, column) {
        if (value === null || value === undefined) {
            return '<span class="text-muted">-</span>';
        }
        
        switch (column.type) {
            case 'badge':
                return `<span class="badge badge-${column.badgeType || 'secondary'}">${value}</span>`;
            case 'boolean':
                return value ? '<i class="fas fa-check text-success"></i>' : '<i class="fas fa-times text-error"></i>';
            case 'date':
                return new Date(value).toLocaleDateString();
            case 'datetime':
                return new Date(value).toLocaleString();
            case 'number':
                return Number(value).toLocaleString();
            case 'currency':
                return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
            case 'percentage':
                return `${(value * 100).toFixed(1)}%`;
            case 'link':
                return `<a href="${value}" target="_blank" rel="noopener">${value}</a>`;
            case 'html':
                return value;
            default:
                return String(value);
        }
    }

    updatePagination() {
        if (!this.options.paginated) return;
        
        const pagination = document.getElementById(`${this.containerId}-pagination`);
        if (!pagination) return;
        
        const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        
        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <button class="btn btn-sm ${this.currentPage === 1 ? 'btn-ghost' : 'btn-secondary'}" 
                    ${this.currentPage === 1 ? 'disabled' : ''} 
                    onclick="window.dataTables['${this.containerId}'].goToPage(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);
        
        if (startPage > 1) {
            paginationHTML += `<button class="btn btn-sm btn-ghost" onclick="window.dataTables['${this.containerId}'].goToPage(1)">1</button>`;
            if (startPage > 2) {
                paginationHTML += '<span class="pagination-ellipsis">...</span>';
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="btn btn-sm ${i === this.currentPage ? 'btn-primary' : 'btn-ghost'}" 
                        onclick="window.dataTables['${this.containerId}'].goToPage(${i})">
                    ${i}
                </button>
            `;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += '<span class="pagination-ellipsis">...</span>';
            }
            paginationHTML += `<button class="btn btn-sm btn-ghost" onclick="window.dataTables['${this.containerId}'].goToPage(${totalPages})">${totalPages}</button>`;
        }
        
        // Next button
        paginationHTML += `
            <button class="btn btn-sm ${this.currentPage === totalPages ? 'btn-ghost' : 'btn-secondary'}" 
                    ${this.currentPage === totalPages ? 'disabled' : ''} 
                    onclick="window.dataTables['${this.containerId}'].goToPage(${this.currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        pagination.innerHTML = paginationHTML;
    }

    updateSelectionInfo() {
        if (!this.options.selectable) return;
        
        const selectionInfo = document.getElementById(`${this.containerId}-selection`);
        if (!selectionInfo) return;
        
        const selectedCount = this.selectedRows.size;
        const totalCount = this.filteredData.length;
        
        selectionInfo.textContent = selectedCount > 0 ? 
            `${selectedCount} of ${totalCount} selected` : 
            `${totalCount} items`;
    }

    updateSortIcons() {
        const headers = this.container.querySelectorAll('.sortable .sort-icon');
        headers.forEach(icon => {
            icon.className = 'fas fa-sort sort-icon';
        });
        
        if (this.sortColumn) {
            const column = this.columns.find(col => col.key === this.sortColumn);
            if (column) {
                const columnIndex = this.columns.indexOf(column) + (this.options.selectable ? 1 : 0);
                const header = this.container.querySelector(`th:nth-child(${columnIndex + 1}) .sort-icon`);
                if (header) {
                    header.className = `fas fa-sort-${this.sortDirection === 'asc' ? 'up' : 'down'} sort-icon`;
                }
            }
        }
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.updateDisplay();
        }
    }

    toggleRowSelection(index, selected) {
        if (selected) {
            this.selectedRows.add(index);
        } else {
            this.selectedRows.delete(index);
        }
        
        this.updateSelectionInfo();
        
        if (this.callbacks.onSelectionChange) {
            this.callbacks.onSelectionChange(Array.from(this.selectedRows));
        }
    }

    toggleAllSelection(selectAll) {
        if (selectAll) {
            for (let i = 0; i < this.filteredData.length; i++) {
                this.selectedRows.add(i);
            }
        } else {
            this.selectedRows.clear();
        }
        
        // Update checkboxes
        const checkboxes = this.container.querySelectorAll('tbody input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAll;
        });
        
        this.updateSelectionInfo();
        
        if (this.callbacks.onSelectionChange) {
            this.callbacks.onSelectionChange(Array.from(this.selectedRows));
        }
    }

    getSelectedRows() {
        return Array.from(this.selectedRows).map(index => this.filteredData[index]);
    }

    clearSelection() {
        this.selectedRows.clear();
        this.updateDisplay();
    }

    refresh() {
        this.filterAndSort();
        this.updateDisplay();
    }

    exportData(format = 'csv') {
        const data = this.filteredData;
        const headers = this.columns.map(col => col.title);
        
        let content = '';
        
        if (format === 'csv') {
            content = headers.join(',') + '\n';
            content += data.map(row => {
                return this.columns.map(col => {
                    const value = this.getCellValue(row, col);
                    return `"${String(value).replace(/"/g, '""')}"`;
                }).join(',');
            }).join('\n');
        } else if (format === 'json') {
            content = JSON.stringify(data, null, 2);
        }
        
        const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `data.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    }

    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // Remove from global registry
        if (window.dataTables && window.dataTables[this.containerId]) {
            delete window.dataTables[this.containerId];
        }
    }
}

// Global registry for pagination callbacks
if (!window.dataTables) {
    window.dataTables = {};
}

// CSS styles for data table
const dataTableStyles = `
.data-table-container {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    overflow: hidden;
}

.table-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
}

.table-controls-left,
.table-controls-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.search-group {
    position: relative;
    display: flex;
    align-items: center;
}

.search-group i {
    position: absolute;
    left: 0.75rem;
    color: var(--text-muted);
    z-index: 1;
}

.search-input {
    padding-left: 2.5rem;
    min-width: 200px;
}

.table-container {
    overflow-x: auto;
}

.table {
    width: 100%;
    border-collapse: collapse;
}

.table th {
    background: var(--bg-secondary);
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-color);
    white-space: nowrap;
}

.table th.sortable {
    cursor: pointer;
    user-select: none;
}

.table th.sortable:hover {
    background: var(--bg-hover);
}

.header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
}

.sort-icon {
    opacity: 0.5;
    transition: opacity 0.2s;
}

.sortable:hover .sort-icon,
.sort-icon.active {
    opacity: 1;
}

.table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-secondary);
}

.table-row:hover {
    background: var(--bg-hover);
}

.table-row:last-child td {
    border-bottom: none;
}

.select-column {
    width: 40px;
    text-align: center;
}

.empty-state {
    text-align: center;
    padding: 3rem 1rem;
}

.empty-message {
    color: var(--text-muted);
}

.empty-message i {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    display: block;
}

.table-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
}

.pagination {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.pagination-ellipsis {
    padding: 0.375rem 0.5rem;
    color: var(--text-muted);
}

.selection-info {
    font-size: 0.875rem;
    color: var(--text-muted);
}

@media (max-width: 768px) {
    .table-controls {
        flex-direction: column;
        align-items: stretch;
        gap: 1rem;
    }
    
    .table-controls-left,
    .table-controls-right {
        justify-content: center;
    }
    
    .search-input {
        min-width: 100%;
    }
    
    .table-footer {
        flex-direction: column;
        gap: 1rem;
    }
}
`;

// Inject styles
const dataTableStyleSheet = document.createElement('style');
dataTableStyleSheet.textContent = dataTableStyles;
document.head.appendChild(dataTableStyleSheet);

// Export class
window.DataTable = DataTable;