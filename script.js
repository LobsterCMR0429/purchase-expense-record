document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('purchase-form');
    const tableBody = document.getElementById('purchase-body');
    const filterSelect = document.getElementById('filter-status');
    const selectAllCheckbox = document.getElementById('select-all');
    const bulkStatusSelect = document.getElementById('bulk-status');
    const applyBulkButton = document.getElementById('apply-bulk');
    const selectedTotalSpan = document.getElementById('selected-total'); 
    
    // 新增批量入库/开票按钮
    const applyBulkStockedButton = document.getElementById('apply-bulk-stocked');
    const applyBulkInvoicedButton = document.getElementById('apply-bulk-invoiced');

    // 模态框元素 (批量到账日期选择)
    const modal = document.getElementById('modal');
    const modalDateInput = document.getElementById('modal-arrival-date');
    const confirmModalButton = document.getElementById('confirm-arrival-date');
    const cancelModalButton = document.getElementById('cancel-modal');

    // 编辑模态框相关的变量
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-purchase-form');
    const cancelEditButton = document.getElementById('cancel-edit');
    const editRecordIndexInput = document.getElementById('edit-record-index');


    let records = JSON.parse(localStorage.getItem('purchaseRecords')) || [];
    let indicesToUpdate = []; 

    // --- 函数：保存记录到本地存储 ---
    function saveRecords() {
        localStorage.setItem('purchaseRecords', JSON.stringify(records));
    }
    
    // --- 函数：计算并更新总金额 ---
    function updateTotalSummary() {
        let total = 0;
        const checkboxes = document.querySelectorAll('.row-checkbox:checked');
        
        checkboxes.forEach(cb => {
            const index = parseInt(cb.dataset.index);
            // 检查索引是否有效，并且价格是数字
            if (records[index] && !isNaN(records[index].price)) {
                total += records[index].price;
            }
        });

        selectedTotalSpan.textContent = `¥ ${total.toFixed(2)}`;
    }

    // --- 函数：渲染表格 ---
    function renderTable(dataToRender) {
        tableBody.innerHTML = ''; 

        // dataToRender已经是经过筛选和排序的数组
        dataToRender.forEach((record, displayIndex) => {
            // 找到该记录在原始 records 数组中的真实索引 (用于编辑、删除和批量操作)
            const originalIndex = records.findIndex(r => r.id === record.id);
            if (originalIndex === -1) return;

            const row = tableBody.insertRow();
            
            // 添加点击事件监听器，用于打开编辑模态框
            row.addEventListener('click', (e) => {
                // 排除点击复选框、删除按钮等操作元素时触发编辑
                if (!e.target.closest('.row-checkbox') && !e.target.closest('button')) {
                    openEditModal(originalIndex);
                }
            });
            
            // 1. 序号列 (基于当前筛选后的显示顺序)
            const indexCell = row.insertCell();
            indexCell.textContent = displayIndex + 1;

            // 2. 复选框列
            const checkboxCell = row.insertCell();
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('row-checkbox');
            checkbox.dataset.index = originalIndex; // 存储真实索引
            
            // 监听复选框变化，更新总金额
            checkbox.addEventListener('change', updateTotalSummary); 

            checkboxCell.appendChild(checkbox);

            // 订单时间, 名称, 价格, 申请人
            row.insertCell().textContent = record.orderDate;
            row.insertCell().textContent = record.name;
            row.insertCell().textContent = `¥ ${record.price.toFixed(2)}`;
            row.insertCell().textContent = record.applicant; 

            // 入库状态
            const stockedCell = row.insertCell();
            const stockedStatus = record.isStocked ? '是' : '否';
            stockedCell.textContent = stockedStatus;
            stockedCell.classList.add(`status-${record.isStocked ? 'yes' : 'no'}`);

            // 开票状态
            const invoicedCell = row.insertCell();
            const invoicedStatus = record.isInvoiced ? '是' : '否';
            invoicedCell.textContent = invoicedStatus;
            invoicedCell.classList.add(`status-${record.isInvoiced ? 'yes' : 'no'}`);

            // 报账状态
            const statusCell = row.insertCell();
            statusCell.textContent = record.status;
            const statusClass = record.status.replace(/\s/g, ''); 
            statusCell.classList.add(`status-${statusClass}`);

            // 批量提交提示标记
            if (record.isBatchSubmitted && record.status === '已提交报账') {
                statusCell.classList.add('batch-submitted');
            }

            // 到账日期, 备注
            row.insertCell().textContent = record.arrivalDate || 'N/A';
            row.insertCell().textContent = record.notes || '';

            // 操作列：删除按钮
            const actionCell = row.insertCell();
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '删除';
            deleteButton.onclick = (e) => {
                e.stopPropagation(); // 阻止点击删除按钮时触发编辑
                deleteRecord(originalIndex);
            };
            actionCell.appendChild(deleteButton);
        });
        
        // 更新全选框状态和总金额
        updateSelectAllState();
        updateTotalSummary();
    }

    // --- 函数：处理表单提交（新增记录） ---
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const newRecord = {
            id: Date.now(), // 使用时间戳作为唯一ID
            orderDate: document.getElementById('order-date').value,
            name: document.getElementById('name').value,
            price: parseFloat(document.getElementById('price').value),
            applicant: document.getElementById('applicant').value, 
            status: document.getElementById('status').value,
            arrivalDate: document.getElementById('arrival-date').value,
            notes: document.getElementById('notes').value,
            isStocked: document.getElementById('is-stocked').checked,
            isInvoiced: document.getElementById('is-invoiced').checked,
            isBatchSubmitted: false 
        };

        records.push(newRecord);
        saveRecords();
        filterRecords(); // 重新筛选和排序
        form.reset(); 
    });

    // --- 函数：删除记录 ---
    function deleteRecord(index) {
        if (confirm('确定要删除这条记录吗？')) {
            records.splice(index, 1);
            saveRecords();
            filterRecords(); // 重新筛选和排序
        }
    }

    // --- 函数：筛选和排序记录 ---
    function filterRecords() {
        const selectedStatus = filterSelect.value;
        let filteredRecords = records;

        if (selectedStatus !== 'all') {
            filteredRecords = records.filter(record => record.status === selectedStatus);
        }

        // 按订单日期升序排序 (小日期在前)
        filteredRecords.sort((a, b) => {
            if (a.orderDate < b.orderDate) return -1; 
            if (a.orderDate > b.orderDate) return 1;
            return 0;
        });

        renderTable(filteredRecords);
    }
    
    // 监听筛选下拉框变化
    filterSelect.addEventListener('change', filterRecords);


    // ====================================================
    // --- 编辑模态框功能 ---

    // 1. 打开编辑模态框并加载数据
    function openEditModal(index) {
        const record = records[index];
        
        editRecordIndexInput.value = index; 

        document.getElementById('edit-order-date').value = record.orderDate;
        document.getElementById('edit-name').value = record.name;
        document.getElementById('edit-price').value = record.price;
        document.getElementById('edit-applicant').value = record.applicant;
        document.getElementById('edit-status').value = record.status;
        document.getElementById('edit-arrival-date').value = record.arrivalDate;
        document.getElementById('edit-notes').value = record.notes;
        document.getElementById('edit-is-stocked').checked = record.isStocked;
        document.getElementById('edit-is-invoiced').checked = record.isInvoiced;

        editModal.style.display = 'block';
    }

    // 2. 取消编辑
    cancelEditButton.addEventListener('click', () => {
        editModal.style.display = 'none';
        editForm.reset();
    });

    // 3. 保存编辑
    editForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const index = parseInt(editRecordIndexInput.value);
        if (isNaN(index) || index < 0 || index >= records.length) return;

        // 更新记录对象
        records[index].orderDate = document.getElementById('edit-order-date').value; 
        records[index].name = document.getElementById('edit-name').value;
        records[index].price = parseFloat(document.getElementById('edit-price').value);
        records[index].applicant = document.getElementById('edit-applicant').value;
        records[index].status = document.getElementById('edit-status').value;
        records[index].arrivalDate = document.getElementById('edit-arrival-date').value;
        records[index].notes = document.getElementById('edit-notes').value;
        records[index].isStocked = document.getElementById('edit-is-stocked').checked;
        records[index].isInvoiced = document.getElementById('edit-is-invoiced').checked;
        
        saveRecords();
        filterRecords(); // 重新排序，因为订单日期可能已更改
        editModal.style.display = 'none';
        editForm.reset();
        updateTotalSummary(); 
    });

    // ====================================================
    // --- 批量操作逻辑 ---

    // 1. 全选/全不选 逻辑
    selectAllCheckbox.addEventListener('change', () => {
        const checkboxes = document.querySelectorAll('.row-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = selectAllCheckbox.checked;
        });
        updateTotalSummary(); // 更新总和
    });

    // 2. 更新全选框状态
    function updateSelectAllState() {
        const checkboxes = document.querySelectorAll('.row-checkbox');
        if (checkboxes.length === 0) {
            selectAllCheckbox.checked = false;
            return;
        }
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        selectAllCheckbox.checked = allChecked;
    }
    
    // --- 6. 通用布尔值批量更新函数 (入库/开票) ---
    function updateRecordsToggle(field, value, actionName) {
        indicesToUpdate = Array.from(document.querySelectorAll('.row-checkbox:checked'))
                               .map(cb => parseInt(cb.dataset.index));

        if (indicesToUpdate.length === 0) {
            return alert('请选择至少一个采购项目进行批量' + actionName + '！');
        }

        if (!confirm(`确定将选中的 ${indicesToUpdate.length} 个项目标记为 "${value ? '已' : '未'}${actionName}" 吗？`)) {
            return;
        }

        indicesToUpdate.forEach(index => {
            records[index][field] = value;
        });

        saveRecords();
        filterRecords(); 
        indicesToUpdate = []; 
        updateTotalSummary(); 
        alert(`成功将 ${indicesToUpdate.length} 个项目批量标记为 "${value ? '已' : '未'}${actionName}"。`);
    }

    // --- 7. 批量入库事件 ---
    applyBulkStockedButton.addEventListener('click', () => {
        // 假设点击是想标记为 "已入库" (true)
        updateRecordsToggle('isStocked', true, '入库');
    });

    // --- 8. 批量开票事件 ---
    applyBulkInvoicedButton.addEventListener('click', () => {
        // 假设点击是想标记为 "已开票" (true)
        updateRecordsToggle('isInvoiced', true, '开票');
    });


    // --- 3. 应用报账操作按钮点击事件 ---
    applyBulkButton.addEventListener('click', () => {
        const newStatus = bulkStatusSelect.value;
        if (!newStatus) return alert('请选择要更改的状态！');
        
        indicesToUpdate = Array.from(document.querySelectorAll('.row-checkbox:checked'))
                               .map(cb => parseInt(cb.dataset.index));

        if (indicesToUpdate.length === 0) return alert('请选择至少一个采购项目！');
        
        if (newStatus === '已到账') {
            modal.style.display = 'block';
        } else {
            updateRecordsStatus(newStatus, null);
        }
    });

    // 4. 批量到账日期模态框操作
    cancelModalButton.addEventListener('click', () => {
        modal.style.display = 'none';
        modalDateInput.value = '';
    });

    confirmModalButton.addEventListener('click', () => {
        const arrivalDate = modalDateInput.value;
        if (!arrivalDate) {
            return alert('请选择到账日期！');
        }
        updateRecordsStatus('已到账', arrivalDate);
        modal.style.display = 'none';
        modalDateInput.value = '';
    });

    // 5. 核心报账状态更新函数
    function updateRecordsStatus(newStatus, arrivalDate) {
        indicesToUpdate.forEach(index => {
            records[index].status = newStatus;
            
            if (newStatus === '已提交报账') {
                records[index].isBatchSubmitted = true;
            } else {
                records[index].isBatchSubmitted = false; 
            }
            
            if (newStatus === '已到账' && arrivalDate) {
                records[index].arrivalDate = arrivalDate;
            } else if (newStatus !== '已到账') {
                records[index].arrivalDate = ''; 
            }
        });

        saveRecords();
        filterRecords(); // 重新排序，确保列表更新
        bulkStatusSelect.value = ''; 
        indicesToUpdate = []; 
        updateTotalSummary(); 
    }
    // ====================================================

    // 页面加载时，渲染初始数据
    filterRecords(); 
});