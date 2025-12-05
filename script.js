document.addEventListener('DOMContentLoaded', () => {
    // ====================================================
    // 0. 初始化与变量声明
    // ====================================================
    const form = document.getElementById('purchase-form');
    const tableContainer = document.getElementById('record-list'); 
    const tableBody = document.getElementById('purchase-body');
    const filterSelect = document.getElementById('filter-status');
    const selectAllCheckbox = document.getElementById('select-all');
    const bulkStatusSelect = document.getElementById('bulk-status');
    const applyBulkButton = document.getElementById('apply-bulk');
    const selectedTotalSpan = document.getElementById('selected-total'); 
    const applyBulkStockedButton = document.getElementById('apply-bulk-stocked');
    const applyBulkInvoicedButton = document.getElementById('apply-bulk-invoiced');
    const modal = document.getElementById('modal');
    const modalDateInput = document.getElementById('modal-arrival-date');
    const confirmModalButton = document.getElementById('confirm-arrival-date');
    const cancelModalButton = document.getElementById('cancel-modal');
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-purchase-form');
    const cancelEditButton = document.getElementById('cancel-edit');
    const editRecordIndexInput = document.getElementById('edit-record-index');

    // 引入全局的 Firebase 实例
    const db = window.db; 
    let records = []; // 数据将从云端加载
    let indicesToUpdate = []; 

    // --- 工具函数：检查是否处于移动视图 ---
    function isMobileView() {
        const table = document.getElementById('purchase-table');
        if (!table) return false;
        return window.getComputedStyle(table).display === 'none';
    }

    // --- 函数：计算并更新总金额 ---
    function updateTotalSummary() {
        let total = 0;
        const checkboxes = document.querySelectorAll('.row-checkbox, .card-checkbox');
        
        checkboxes.forEach(cb => {
            if (cb.checked) {
                const index = parseInt(cb.dataset.index);
                if (records[index] && !isNaN(records[index].price)) {
                    total += records[index].price;
                }
            }
        });

        selectedTotalSpan.textContent = `¥ ${total.toFixed(2)}`;
    }

    // --- 函数：渲染卡片列表 (移动端) ---
    function renderCardList(dataToRender) {
        let cardList = document.querySelector('.card-list');
        if (!cardList) {
            cardList = document.createElement('ul');
            cardList.className = 'card-list';
            tableContainer.appendChild(cardList);
        }
        cardList.innerHTML = ''; 

        dataToRender.forEach((record, displayIndex) => {
            // 查找原始索引
            const originalIndex = records.findIndex(r => r.id === record.id);
            if (originalIndex === -1) return;

            const card = document.createElement('li');
            card.className = 'record-card';
            card.dataset.index = originalIndex; 

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('card-checkbox');
            checkbox.dataset.index = originalIndex; 
            checkbox.addEventListener('change', updateTotalSummary); 
            
            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.className = 'card-action';
            checkboxWrapper.appendChild(checkbox);

            const title = document.createElement('div');
            title.className = 'card-title';
            title.textContent = `${displayIndex + 1}. ${record.name}`;

            const price = document.createElement('div');
            price.className = 'card-price';
            price.textContent = `¥ ${record.price.toFixed(2)}`;
            
            const meta = document.createElement('div');
            meta.className = 'card-meta';
            
            const statusDiv = document.createElement('div');
            statusDiv.className = `card-status status-${record.status.replace(/\s/g, '')}`;
            statusDiv.textContent = `状态: ${record.status}`;
            if (record.isBatchSubmitted && record.status === '已提交报账') {
                statusDiv.classList.add('batch-submitted');
            }
            
            const orderDateDiv = document.createElement('div');
            orderDateDiv.className = 'card-date';
            orderDateDiv.textContent = `订单: ${record.orderDate}`;
            
            const applicantDiv = document.createElement('div');
            applicantDiv.className = 'card-applicant';
            applicantDiv.textContent = `申请人: ${record.applicant}`;
            
            const toggleDiv = document.createElement('div');
            toggleDiv.className = 'card-toggle';
            toggleDiv.innerHTML = `
                入库: <span class="status-${record.isStocked ? 'yes' : 'no'}">${record.isStocked ? '是' : '否'}</span> |
                开票: <span class="status-${record.isInvoiced ? 'yes' : 'no'}">${record.isInvoiced ? '是' : '否'}</span>
            `;

            meta.appendChild(statusDiv);
            meta.appendChild(orderDateDiv);
            meta.appendChild(applicantDiv);
            meta.appendChild(toggleDiv);

            card.appendChild(checkboxWrapper);
            card.appendChild(title);
            card.appendChild(price);
            card.appendChild(meta);

            card.addEventListener('click', (e) => {
                if (!e.target.closest('.card-checkbox')) {
                    openEditModal(originalIndex);
                }
            });

            cardList.appendChild(card);
        });

        document.getElementById('purchase-table').style.display = 'none';
        cardList.style.display = 'block';
        selectAllCheckbox.parentElement.style.display = 'none';
    }


    // --- 函数：渲染表格 (PC端) ---
    function renderTable(dataToRender) {
        const cardList = document.querySelector('.card-list');
        if (cardList) {
            cardList.remove();
        }

        document.getElementById('purchase-table').style.display = 'table';
        selectAllCheckbox.parentElement.style.display = 'block'; 

        tableBody.innerHTML = ''; 

        dataToRender.forEach((record, displayIndex) => {
            const originalIndex = records.findIndex(r => r.id === record.id);
            if (originalIndex === -1) return;

            const row = tableBody.insertRow();
            
            row.addEventListener('click', (e) => {
                if (!e.target.closest('.row-checkbox') && !e.target.closest('button')) {
                    openEditModal(originalIndex);
                }
            });
            
            const indexCell = row.insertCell();
            indexCell.textContent = displayIndex + 1;

            const checkboxCell = row.insertCell();
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('row-checkbox');
            checkbox.dataset.index = originalIndex; 
            checkbox.addEventListener('change', updateTotalSummary); 
            checkboxCell.appendChild(checkbox);

            row.insertCell().textContent = record.orderDate;
            row.insertCell().textContent = record.name;
            row.insertCell().textContent = `¥ ${record.price.toFixed(2)}`;
            row.insertCell().textContent = record.applicant; 

            const stockedCell = row.insertCell();
            const stockedStatus = record.isStocked ? '是' : '否';
            stockedCell.textContent = stockedStatus;
            stockedCell.classList.add(`status-${record.isStocked ? 'yes' : 'no'}`);

            const invoicedCell = row.insertCell();
            const invoicedStatus = record.isInvoiced ? '是' : '否';
            invoicedCell.textContent = invoicedStatus;
            invoicedCell.classList.add(`status-${record.isInvoiced ? 'yes' : 'no'}`);

            const statusCell = row.insertCell();
            statusCell.textContent = record.status;
            const statusClass = record.status.replace(/\s/g, ''); 
            statusCell.classList.add(`status-${statusClass}`);

            if (record.isBatchSubmitted && record.status === '已提交报账') {
                statusCell.classList.add('batch-submitted');
            }

            row.insertCell().textContent = record.arrivalDate || 'N/A';
            row.insertCell().textContent = record.notes || '';

            const actionCell = row.insertCell();
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '删除';
            deleteButton.onclick = (e) => {
                e.stopPropagation(); 
                deleteRecord(originalIndex);
            };
            actionCell.appendChild(deleteButton);
        });
    }


    // --- 函数：主渲染逻辑 (根据视图选择渲染方式) ---
    function masterRender(dataToRender) {
        if (isMobileView()) {
            renderCardList(dataToRender);
            selectAllCheckbox.checked = false;
        } else {
            renderTable(dataToRender);
        }
        
        updateSelectAllState();
        updateTotalSummary();
    }


    // --- 核心函数：筛选和排序记录 ---
    function filterRecords() {
        const selectedStatus = filterSelect.value;
        let filteredRecords = records;

        if (selectedStatus !== 'all') {
            filteredRecords = records.filter(record => record.status === selectedStatus);
        }

        // 按订单日期升序排序
        filteredRecords.sort((a, b) => {
            if (a.orderDate < b.orderDate) return -1; 
            if (a.orderDate > b.orderDate) return 1;
            return 0;
        });

        masterRender(filteredRecords);
    }
    
    // 监听筛选下拉框变化
    filterSelect.addEventListener('change', filterRecords);

    
    // ====================================================
    // 1. 替换：从 Firestore 实时加载数据
    // ====================================================

    function loadRecordsFromFirestore() {
        // 监听 "purchases" 集合的变化，并按 orderDate 排序
        db.collection("purchases").orderBy("orderDate", "asc").onSnapshot((snapshot) => {
            records = []; // 清空现有记录
            snapshot.forEach((doc) => {
                // 将 Firestore 文档数据和其ID存入 records 数组
                records.push({
                    ...doc.data(),
                    id: doc.id // 存储 Firestore ID 作为记录的唯一标识符
                });
            });
            
            // 数据更新后，重新筛选和渲染表格/卡片
            filterRecords(); 
            updateTotalSummary();
        }, (error) => {
            console.error("监听 Firestore 失败:", error);
            // 仅在初始加载时提示严重错误
            if (records.length === 0) {
                 alert("无法连接到云端数据库。请检查 Firebase 配置和网络连接。");
            }
        });
    }

    // ====================================================
    // 2. 替换：处理表单提交（新增记录）
    // ====================================================
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const newRecord = {
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

        db.collection("purchases").add(newRecord)
            .then(() => {
                // onSnapshot 会自动触发渲染
                form.reset(); 
            })
            .catch((error) => {
                console.error("写入错误: ", error);
                alert("数据保存失败，请检查 Firebase 配置和安全规则。");
            });
    });

    // ====================================================
    // 3. 替换：删除记录
    // ====================================================
    function deleteRecord(index) {
        const docId = records[index].id; // 使用 Firestore ID
        if (confirm('确定要删除这条记录吗？')) {
            db.collection("purchases").doc(docId).delete()
                .then(() => {
                    // onSnapshot 会自动触发渲染
                })
                .catch((error) => {
                    console.error("删除失败: ", error);
                    alert("删除操作失败。");
                });
        }
    }


    // ====================================================
    // 4. 替换：编辑记录的保存逻辑
    // ====================================================
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
        document.body.style.overflow = 'hidden';
    }
    
    cancelEditButton.addEventListener('click', () => {
        editModal.style.display = 'none';
        editForm.reset();
        document.body.style.overflow = 'auto';
    });


    editForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const index = parseInt(editRecordIndexInput.value);
        if (isNaN(index) || index < 0 || index >= records.length) return;

        const docId = records[index].id; // 使用 Firestore ID

        // 构造要更新的对象
        const updatedFields = {
            orderDate: document.getElementById('edit-order-date').value, 
            name: document.getElementById('edit-name').value,
            price: parseFloat(document.getElementById('edit-price').value),
            applicant: document.getElementById('edit-applicant').value,
            status: document.getElementById('edit-status').value,
            arrivalDate: document.getElementById('edit-arrival-date').value,
            notes: document.getElementById('edit-notes').value,
            isStocked: document.getElementById('edit-is-stocked').checked,
            isInvoiced: document.getElementById('edit-is-invoiced').checked,
        };

        db.collection("purchases").doc(docId).update(updatedFields)
            .then(() => {
                // onSnapshot 会自动触发渲染
                editModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            })
            .catch((error) => {
                console.error("更新失败: ", error);
                alert("更新操作失败，请检查网络。");
            });
    });

    // --- 全选/全不选 逻辑 ---
    selectAllCheckbox.addEventListener('change', () => {
        const checkboxes = document.querySelectorAll('.row-checkbox, .card-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = selectAllCheckbox.checked;
        });
        updateTotalSummary(); 
    });

    function updateSelectAllState() {
        if (isMobileView()) { return; }
        const checkboxes = document.querySelectorAll('.row-checkbox');
        if (checkboxes.length === 0) {
            selectAllCheckbox.checked = false;
            return;
        }
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        selectAllCheckbox.checked = allChecked;
    }


    // ====================================================
    // 5. 替换：批量操作逻辑 (使用 Firestore.update)
    // ====================================================
    
    // --- 通用批量更新函数 ---
    function updateRecordsToggle(field, value, actionName) {
        // 获取所有选中的记录的 Firestore ID
        const docIdsToUpdate = Array.from(document.querySelectorAll('.row-checkbox:checked, .card-checkbox:checked'))
                               .map(cb => records[parseInt(cb.dataset.index)].id);

        if (docIdsToUpdate.length === 0) {
            return alert('请选择至少一个采购项目进行批量' + actionName + '！');
        }

        if (!confirm(`确定将选中的 ${docIdsToUpdate.length} 个项目标记为 "${value ? '已' : '未'}${actionName}" 吗？`)) {
            return;
        }

        // 使用 Promise.all 批量更新
        const updatePromises = docIdsToUpdate.map(docId => {
            const updateObj = {};
            updateObj[field] = value;
            return db.collection("purchases").doc(docId).update(updateObj);
        });

        Promise.all(updatePromises)
            .then(() => {
                alert(`成功将 ${docIdsToUpdate.length} 个项目批量标记为 "${value ? '已' : '未'}${actionName}"。`);
                // onSnapshot 会自动触发渲染
            })
            .catch(error => {
                console.error("批量更新失败:", error);
                alert("批量操作失败，请重试。");
            });
    }

    // --- 批量入库/开票事件 ---
    applyBulkStockedButton.addEventListener('click', () => {
        updateRecordsToggle('isStocked', true, '入库');
    });
    applyBulkInvoicedButton.addEventListener('click', () => {
        updateRecordsToggle('isInvoiced', true, '开票');
    });
    
    // --- 应用报账操作按钮点击事件 (触发批量状态更新) ---
    applyBulkButton.addEventListener('click', () => {
        const newStatus = bulkStatusSelect.value;
        if (!newStatus) return alert('请选择要更改的状态！');
        
        indicesToUpdate = Array.from(document.querySelectorAll('.row-checkbox:checked, .card-checkbox:checked'))
                               .map(cb => parseInt(cb.dataset.index));

        if (indicesToUpdate.length === 0) return alert('请选择至少一个采购项目！');
        
        if (newStatus === '已到账') {
            modal.style.display = 'block';
        } else {
            updateRecordsStatus(newStatus, null);
        }
    });

    // 批量到账日期模态框操作
    confirmModalButton.addEventListener('click', () => {
        const arrivalDate = modalDateInput.value;
        if (!arrivalDate) {
            return alert('请选择到账日期！');
        }
        updateRecordsStatus('已到账', arrivalDate);
        modal.style.display = 'none';
        modalDateInput.value = '';
    });
    cancelModalButton.addEventListener('click', () => {
        modal.style.display = 'none';
        modalDateInput.value = '';
    });


    // --- 核心批量状态更新函数 (使用 Firestore 批量更新) ---
    function updateRecordsStatus(newStatus, arrivalDate) {
        
        const updates = indicesToUpdate.map(index => {
            const record = records[index];
            const updateObj = {
                status: newStatus,
                isBatchSubmitted: (newStatus === '已提交报账')
            };
            
            if (newStatus === '已到账' && arrivalDate) {
                updateObj.arrivalDate = arrivalDate;
            } else if (newStatus !== '已到账') {
                updateObj.arrivalDate = ''; 
            }
            
            return { docId: record.id, data: updateObj };
        });

        const updatePromises = updates.map(u => {
            return db.collection("purchases").doc(u.docId).update(u.data);
        });

        Promise.all(updatePromises)
            .then(() => {
                bulkStatusSelect.value = ''; 
                indicesToUpdate = []; 
                // onSnapshot 会自动触发渲染
            })
            .catch(error => {
                console.error("批量更新状态失败:", error);
                alert("批量更新状态失败，请重试。");
            });
    }

    // ====================================================
    // 6. 启动应用
    // ====================================================

    // 监听窗口大小变化
    window.addEventListener('resize', () => {
        clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(filterRecords, 200); 
    });


    // 页面加载时，开始从 Firestore 加载数据
    loadRecordsFromFirestore(); 
});
