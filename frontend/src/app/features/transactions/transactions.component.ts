import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { TransactionDto, TransactionsResponse } from '../../core/models/transaction.model';
import { ToastService } from '../../shared/components/toast/toast.service';
import { AudCurrencyPipe } from '../../shared/pipes/currency-aud.pipe';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule, AudCurrencyPipe],
  template: `
    <div >

      <!-- Filter Bar (hidden when embedded with envelopeId) -->
      @if (!isEmbedded) {
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 mb-4">
          <div class="p-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
              <div>
                <label class="form-label mb-1 text-sm">Group</label>
                <select class="form-select form-select-sm" [(ngModel)]="filterGroupName" (ngModelChange)="onGroupChange()">
                  <option value="">All Groups</option>
                  @for (g of groups; track g) {
                    <option [value]="g">{{ g }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="form-label mb-1 text-sm">Envelope</label>
                <select class="form-select form-select-sm" [(ngModel)]="filterEnvelopeId">
                  <option [ngValue]="0">All Envelopes</option>
                  @for (env of filteredEnvelopes; track env.id) {
                    <option [ngValue]="env.id">{{ env.name }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="form-label mb-1 text-sm">From</label>
                <input type="date" class="form-control form-control-sm" [(ngModel)]="filterDateFrom" />
              </div>
              <div>
                <label class="form-label mb-1 text-sm">To</label>
                <input type="date" class="form-control form-control-sm" [(ngModel)]="filterDateTo" />
              </div>
              <div>
                <button class="btn btn-primary btn-sm" (click)="applyFilters()">Apply</button>
                <button class="btn btn-outline-secondary btn-sm ms-1" (click)="resetFilters()">Reset</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="mb-3">
          <button class="btn btn-success btn-sm me-2" (click)="openAddModal()">+ Add Transaction</button>
          <button class="btn btn-outline-success btn-sm" (click)="openIncomeModal()">+ Record Income</button>
        </div>
      } @else {
        <!-- Minimal action buttons when embedded (hide for recurring view) -->
        @if (!recurringItemId) {
          <div class="mb-3">
            <button class="btn btn-success btn-sm" (click)="openAddModal()">+ Add Transaction</button>
          </div>
        }
      }

      <!-- Transactions Table -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-800 text-white">
            <tr>
              <th class="px-4 py-3">Date</th>
              @if (!isEmbedded) {
                <th class="px-4 py-3">Envelope</th>
              }
              <th class="px-4 py-3 text-end">Amount</th>
              <th class="px-4 py-3">Description</th>
              @if (recurringItemId) {
                <th class="px-4 py-3 text-center" style="width: 100px">Status</th>
              }
              <th class="px-4 py-3" style="width: 160px">Attachments</th>
              <th class="px-4 py-3 text-center" style="width: 120px">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (txn of transactions; track trackRow(txn)) {
              <tr [class.table-success-light]="txn.rowType === 'bonus'"
                  [class.table-info-light]="txn.rowType === 'income'">
                <td class="px-4 py-2.5">{{ txn.date }}</td>
                @if (!isEmbedded) {
                  <td>
                    @if (txn.rowType === 'income') {
                      {{ txn.envelopeName }}
                    } @else {
                      {{ txn.groupName }} &gt; {{ txn.envelopeName }}
                      @if (txn.rowType === 'bonus') {
                        <span class="text-slate-400 text-xs ml-1">Bonus</span>
                      }
                    }
                  </td>
                }
                <td class="px-4 py-2.5 text-end"
                  [class.text-danger]="txn.rowType === 'txn' && txn.amount > 0"
                  [class.text-success]="txn.rowType === 'bonus' || txn.rowType === 'income' || txn.amount < 0">
                  @if (txn.rowType === 'bonus' || txn.rowType === 'income' || txn.amount < 0) {
                    +{{ absVal(txn.amount) | aud:2 }}
                  } @else {
                    -{{ txn.amount | aud:2 }}
                  }
                </td>
                <td class="px-4 py-2.5">{{ txn.description }}</td>
                @if (recurringItemId) {
                  <td class="text-center">
                    @if (txn.status === 'pending') {
                      Pending
                    } @else if (txn.status === 'scheduled') {
                      Scheduled
                    } @else {
                      Committed
                    }
                  </td>
                }
                <td class="px-4 py-2.5 small">
                  @if (txn.attachmentName) {
                    <a href="javascript:void(0)" (click)="openAttachmentModal(txn)" class="no-underline text-brand-500">
                      {{ txn.attachmentName }}
                      @if (txn.attachmentCount && txn.attachmentCount > 1) {
                        <span class="text-slate-400"> +{{ txn.attachmentCount! - 1 }} more</span>
                      }
                    </a>
                  } @else {
                    <span class="text-slate-400">&#8211;</span>
                  }
                </td>
                <td class="text-center">
                  @if (txn.status !== 'pending' && txn.status !== 'scheduled') {
                    <div class="flex gap-1">
                      <button class="btn btn-outline-primary" title="Edit" (click)="openEditModal(txn)"><i class="bi bi-pencil"></i></button>
                      <button class="btn btn-outline-secondary" title="Attach" (click)="openAttachmentModal(txn)"><i class="bi bi-paperclip"></i></button>
                      <button class="btn btn-outline-danger" title="Delete" (click)="confirmDeleteRow(txn)"><i class="bi bi-x-lg"></i></button>
                    </div>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td [attr.colspan]="recurringItemId ? 6 : isEmbedded ? 5 : 6" class="text-center text-slate-500 py-6">No transactions found.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Load More -->
      @if (shownCount < totalCount) {
        <div class="text-center my-4">
          <button class="btn btn-outline-primary btn-sm" (click)="loadMore()">
            Load more (showing {{ shownCount }} of {{ totalCount }})
          </button>
        </div>
      }

      <!-- Add Transaction Modal -->
      @if (showAddModal) {
        <div class="modal-backdrop fade show"></div>
        <div class="modal fade show d-block" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Add Transaction</h5>
                <button type="button" class="btn-close" (click)="showAddModal = false"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">Date</label>
                  <input type="date" class="form-control" [(ngModel)]="addForm.date" [min]="cycleStart" />
                </div>
                @if (!isEmbedded) {
                  <div class="mb-3">
                    <label class="form-label">Envelope</label>
                    <select class="form-select" [(ngModel)]="addForm.envelopeId">
                      @for (env of envelopes; track env.id) {
                        <option [ngValue]="env.id">{{ env.groupName }} &gt; {{ env.name }}</option>
                      }
                    </select>
                  </div>
                }
                <div class="mb-3">
                  <label class="form-label">Amount</label>
                  <input type="number" step="0.01" class="form-control" [(ngModel)]="addForm.amount" />
                </div>
                <div class="mb-3">
                  <label class="form-label">Description</label>
                  <input type="text" class="form-control" [(ngModel)]="addForm.description" />
                </div>
                <div class="mb-3">
                  <label class="form-label">Attachment (optional)</label>
                  <input type="file" class="form-control form-control-sm" (change)="onAddFileSelected($event)" />
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" (click)="showAddModal = false">Cancel</button>
                <button class="btn btn-primary" (click)="submitAdd()" [disabled]="addSubmitting">
                  @if (addSubmitting) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Income Modal -->
      @if (showIncomeModal) {
        <div class="modal-backdrop fade show"></div>
        <div class="modal fade show d-block" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Record Income</h5>
                <button type="button" class="btn-close" (click)="showIncomeModal = false"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">Type</label>
                  <select class="form-select" [(ngModel)]="incomeForm.type">
                    <option value="Paycheck">Paycheck</option>
                    <option value="Bonus">Bonus</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label class="form-label">Amount</label>
                  <input type="number" step="0.01" min="0.01" class="form-control" [(ngModel)]="incomeForm.amount" />
                </div>
                <div class="mb-3">
                  <label class="form-label">Date</label>
                  <input type="date" class="form-control" [(ngModel)]="incomeForm.date" />
                </div>
                <div class="mb-3">
                  <label class="form-label">Description</label>
                  <input type="text" class="form-control" [(ngModel)]="incomeForm.description" placeholder="Optional" />
                </div>
                <div class="mb-3">
                  <label class="form-label">Attachment (optional)</label>
                  <input type="file" class="form-control form-control-sm" (change)="onIncomeFileSelected($event)" />
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" (click)="showIncomeModal = false">Cancel</button>
                <button class="btn btn-success" (click)="submitIncome()" [disabled]="incomeSubmitting">
                  @if (incomeSubmitting) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  Record
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Edit Modal (adapts to rowType) -->
      @if (showEditModal) {
        <div class="modal-backdrop fade show"></div>
        <div class="modal fade show d-block" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Edit {{ editRowType === 'income' ? 'Income' : editRowType === 'bonus' ? 'Bonus' : 'Transaction' }}</h5>
                <button type="button" class="btn-close" (click)="showEditModal = false"></button>
              </div>
              <div class="modal-body">
                @if (editRowType === 'txn') {
                  <div class="mb-3">
                    <label class="form-label">Date</label>
                    <input type="date" class="form-control" [(ngModel)]="editForm.date" />
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Envelope</label>
                    <select class="form-select" [(ngModel)]="editForm.envelopeId">
                      @for (env of envelopes; track env.id) {
                        <option [ngValue]="env.id">{{ env.groupName }} &gt; {{ env.name }}</option>
                      }
                    </select>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Amount</label>
                    <input type="number" step="0.01" class="form-control" [(ngModel)]="editForm.amount" />
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Description</label>
                    <input type="text" class="form-control" [(ngModel)]="editForm.description" />
                  </div>
                } @else if (editRowType === 'income') {
                  <div class="mb-3">
                    <label class="form-label">Type</label>
                    <select class="form-select" [(ngModel)]="editIncomeForm.type">
                      <option value="Paycheck">Paycheck</option>
                      <option value="Bonus">Bonus</option>
                      <option value="StockSale">Stock Sale</option>
                    </select>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Amount</label>
                    <input type="number" step="0.01" min="0.01" class="form-control" [(ngModel)]="editIncomeForm.amount" />
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Date</label>
                    <input type="date" class="form-control" [(ngModel)]="editIncomeForm.date" />
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Description</label>
                    <input type="text" class="form-control" [(ngModel)]="editIncomeForm.description" />
                  </div>
                } @else if (editRowType === 'bonus') {
                  <div class="mb-3">
                    <label class="form-label">Amount</label>
                    <input type="number" step="0.01" min="0.01" class="form-control" [(ngModel)]="editBonusForm.amount" />
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Description</label>
                    <input type="text" class="form-control" [(ngModel)]="editBonusForm.description" />
                  </div>
                }
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" (click)="showEditModal = false">Cancel</button>
                <button class="btn btn-primary" (click)="submitEdit()" [disabled]="editSubmitting">
                  @if (editSubmitting) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Attachment Modal -->
      @if (showAttachmentModal) {
        <div class="modal-backdrop fade show"></div>
        <div class="modal fade show d-block" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Attachments</h5>
                <button type="button" class="btn-close" (click)="showAttachmentModal = false"></button>
              </div>
              <div class="modal-body">
                @if (attachments.length > 0) {
                  <ul class="list-group mb-3">
                    @for (att of attachments; track att.id) {
                      <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                          <a href="javascript:void(0)" (click)="viewAttachment(att.id, att.contentType)" class="text-brand-500 hover:text-brand-700">{{ att.fileName }}</a>
                          <span class="text-slate-400 text-sm ml-2">({{ formatFileSize(att.size) }})</span>
                        </div>
                        <button class="btn btn-outline-danger btn-sm" (click)="deleteAttachment(att.id)">Delete</button>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="text-slate-500 text-sm">No attachments yet.</p>
                }
                <div class="mb-2">
                  <label class="form-label">Upload File</label>
                  <input type="file" class="form-control form-control-sm" (change)="onFileSelected($event)" />
                </div>
                @if (uploadError) {
                  <div class="text-over text-sm">{{ uploadError }}</div>
                }
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary btn-sm" (click)="showAttachmentModal = false">Close</button>
                <button class="btn btn-primary btn-sm" (click)="uploadFile()" [disabled]="!selectedFile || uploading">
                  @if (uploading) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Delete Confirmation Modal -->
      @if (showDeleteModal) {
        <div class="modal-backdrop fade show"></div>
        <div class="modal fade show d-block" tabindex="-1">
          <div class="modal-dialog modal-sm">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Confirm Delete</h5>
                <button type="button" class="btn-close" (click)="showDeleteModal = false"></button>
              </div>
              <div class="modal-body">
                <p>Are you sure you want to delete this {{ deleteTarget?.rowType === 'income' ? 'income record' : deleteTarget?.rowType === 'bonus' ? 'bonus' : 'transaction' }}?</p>
                @if (deleteTarget) {
                  <p class="text-muted small mb-0">
                    {{ deleteTarget.description }} ({{ deleteTarget.amount | aud:2 }})
                  </p>
                }
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary btn-sm" (click)="showDeleteModal = false">Cancel</button>
                <button class="btn btn-danger btn-sm" (click)="executeDelete()" [disabled]="deleteSubmitting">
                  @if (deleteSubmitting) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class TransactionsComponent implements OnInit {
  @Input() envelopeId: number | null = null;
  @Input() recurringItemId: number | null = null;

  transactions: TransactionDto[] = [];
  envelopes: { id: number; name: string; groupName: string }[] = [];
  groups: string[] = [];
  filteredEnvelopes: { id: number; name: string; groupName: string }[] = [];
  totalCount = 0;
  shownCount = 0;
  currentPeriod = 0;
  cycleStart = '';

  // Filters
  filterGroupName = '';
  filterEnvelopeId = 0;
  filterDateFrom = '';
  filterDateTo = '';
  currentLimit = 50;

  // Add Transaction Modal
  showAddModal = false;
  addSubmitting = false;
  addFile: File | null = null;
  addForm = { date: '', envelopeId: 0, amount: 0, description: '' };

  // Income Modal
  showIncomeModal = false;
  incomeSubmitting = false;
  incomeFile: File | null = null;
  incomeForm = { type: 'Paycheck', amount: 0, date: '', description: '' };

  // Edit Modal (shared for all row types)
  showEditModal = false;
  editSubmitting = false;
  editRowType: 'txn' | 'income' | 'bonus' = 'txn';
  editId = 0;
  editForm = { date: '', envelopeId: 0, amount: 0, description: '' };
  editIncomeForm = { type: 'Paycheck', amount: 0, date: '', description: '' };
  editBonusForm = { amount: 0, description: '' };

  // Delete Modal
  showDeleteModal = false;
  deleteSubmitting = false;
  deleteTarget: TransactionDto | null = null;

  // Attachment Modal
  showAttachmentModal = false;
  attachmentEntityType = 'txn';
  attachmentEntityId = 0;
  attachments: { id: number; fileName: string; contentType: string; size: number }[] = [];
  selectedFile: File | null = null;
  uploading = false;
  uploadError = '';

  constructor(
    public apiService: ApiService,
    private toastService: ToastService,
  ) {}

  absVal(n: number): number { return Math.abs(n); }

  ngOnInit(): void {
    if (this.envelopeId) {
      this.filterEnvelopeId = this.envelopeId;
    }
    this.loadTransactions();
  }

  get isEmbedded(): boolean { return !!(this.envelopeId || this.recurringItemId); }

  loadTransactions(): void {
    const filters: { envelope_id?: number; group_name?: string; recurring_item_id?: number; date_from?: string; date_to?: string; limit?: number } = {};
    if (this.recurringItemId) {
      filters.recurring_item_id = this.recurringItemId;
    } else if (this.envelopeId) {
      filters.envelope_id = this.envelopeId;
    } else if (this.filterEnvelopeId) {
      filters.envelope_id = this.filterEnvelopeId;
    }
    if (this.filterGroupName) filters.group_name = this.filterGroupName;
    if (this.filterDateFrom) filters.date_from = this.filterDateFrom;
    if (this.filterDateTo) filters.date_to = this.filterDateTo;
    if (this.currentLimit) filters.limit = this.currentLimit;

    this.apiService.getTransactions(filters).subscribe({
      next: (res: TransactionsResponse) => {
        this.transactions = res.transactions;
        this.envelopes = res.envelopes;
        this.groups = res.groups || [];
        this.updateFilteredEnvelopes();
        this.totalCount = res.totalCount;
        this.shownCount = res.shownCount;
        this.currentPeriod = res.currentPeriod;
        this.cycleStart = res.cycleStart;
      },
      error: () => { this.toastService.error('Failed to load transactions.'); },
    });
  }

  applyFilters(): void { this.currentLimit = 50; this.loadTransactions(); }

  onGroupChange(): void {
    this.filterEnvelopeId = 0;
    this.updateFilteredEnvelopes();
    this.currentLimit = 50;
    this.loadTransactions();
  }

  updateFilteredEnvelopes(): void {
    if (this.filterGroupName) {
      this.filteredEnvelopes = this.envelopes.filter(e => e.groupName === this.filterGroupName);
    } else {
      this.filteredEnvelopes = this.envelopes;
    }
  }

  resetFilters(): void {
    this.filterGroupName = '';
    this.filterEnvelopeId = 0;
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.currentLimit = 50;
    this.updateFilteredEnvelopes();
    this.loadTransactions();
  }

  loadMore(): void { this.currentLimit += 50; this.loadTransactions(); }

  trackRow(txn: TransactionDto): string { return txn.rowType + '_' + txn.id; }

  // --- Add Transaction ---
  openAddModal(): void {
    const today = new Date().toISOString().split('T')[0];
    this.addForm = {
      date: today,
      envelopeId: this.envelopeId || (this.envelopes.length > 0 ? this.envelopes[0].id : 0),
      amount: 0,
      description: '',
    };
    this.addFile = null;
    this.addSubmitting = false;
    this.showAddModal = true;
  }

  onAddFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFile = input.files && input.files.length > 0 ? input.files[0] : null;
  }

  submitAdd(): void {
    if (!this.addForm.envelopeId || !this.addForm.date) {
      this.toastService.error('Please fill in all required fields.');
      return;
    }
    this.addSubmitting = true;
    this.apiService.createTransaction(this.addForm).subscribe({
      next: (res: any) => {
        if (this.addFile && res.id) {
          this.apiService.uploadAttachment(res.id, this.addFile, 'txn').subscribe({
            next: () => { this.toastService.success('Transaction added with attachment.'); this.showAddModal = false; this.addFile = null; this.loadTransactions(); },
            error: () => { this.toastService.success('Transaction added (attachment upload failed).'); this.showAddModal = false; this.addFile = null; this.loadTransactions(); },
          });
        } else {
          this.toastService.success('Transaction added.');
          this.showAddModal = false;
          this.loadTransactions();
        }
      },
      error: (err) => { this.toastService.error(err.error?.error || 'Failed to add transaction.'); this.addSubmitting = false; },
    });
  }

  // --- Record Income ---
  openIncomeModal(): void {
    const today = new Date().toISOString().split('T')[0];
    this.incomeForm = { type: 'Paycheck', amount: 0, date: today, description: '' };
    this.incomeFile = null;
    this.incomeSubmitting = false;
    this.showIncomeModal = true;
  }

  onIncomeFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.incomeFile = input.files && input.files.length > 0 ? input.files[0] : null;
  }

  submitIncome(): void {
    if (!this.incomeForm.amount || this.incomeForm.amount <= 0) {
      this.toastService.error('Please enter a positive amount.');
      return;
    }
    if (!this.incomeForm.date) {
      this.toastService.error('Please select a date.');
      return;
    }
    this.incomeSubmitting = true;
    this.apiService.createIncome(this.incomeForm).subscribe({
      next: (res: any) => {
        if (this.incomeFile && res.id) {
          this.apiService.uploadAttachment(res.id, this.incomeFile, 'income').subscribe({
            next: () => { this.toastService.success('Income recorded with attachment.'); this.showIncomeModal = false; this.incomeFile = null; this.loadTransactions(); },
            error: () => { this.toastService.success('Income recorded (attachment upload failed).'); this.showIncomeModal = false; this.incomeFile = null; this.loadTransactions(); },
          });
        } else {
          this.toastService.success('Income recorded.');
          this.showIncomeModal = false;
          this.loadTransactions();
        }
      },
      error: (err) => { this.toastService.error(err.error?.error || 'Failed to record income.'); this.incomeSubmitting = false; },
    });
  }

  // --- Edit (all row types) ---
  openEditModal(txn: TransactionDto): void {
    this.editRowType = txn.rowType;
    this.editId = txn.id;
    this.editSubmitting = false;

    if (txn.rowType === 'txn') {
      this.editForm = { date: txn.date, envelopeId: txn.envelopeId, amount: txn.amount, description: txn.description };
    } else if (txn.rowType === 'income') {
      let typeCode = txn.envelopeName;
      if (typeCode === 'Stock Sale') typeCode = 'StockSale';
      this.editIncomeForm = { type: typeCode, amount: txn.amount, date: txn.date, description: txn.description };
    } else if (txn.rowType === 'bonus') {
      this.editBonusForm = { amount: txn.amount, description: txn.description };
    }
    this.showEditModal = true;
  }

  submitEdit(): void {
    this.editSubmitting = true;
    if (this.editRowType === 'txn') {
      if (!this.editForm.envelopeId || !this.editForm.date) {
        this.toastService.error('Please fill in all required fields.'); this.editSubmitting = false; return;
      }
      this.apiService.updateTransaction(this.editId, this.editForm).subscribe({
        next: () => { this.toastService.success('Transaction updated.'); this.showEditModal = false; this.loadTransactions(); },
        error: (err) => { this.toastService.error(err.error?.error || 'Failed to update.'); this.editSubmitting = false; },
      });
    } else if (this.editRowType === 'income') {
      this.apiService.updateIncome(this.editId, this.editIncomeForm).subscribe({
        next: () => { this.toastService.success('Income updated.'); this.showEditModal = false; this.loadTransactions(); },
        error: (err) => { this.toastService.error(err.error?.error || 'Failed to update.'); this.editSubmitting = false; },
      });
    } else if (this.editRowType === 'bonus') {
      this.apiService.updateBonus(this.editId, this.editBonusForm).subscribe({
        next: () => { this.toastService.success('Bonus updated.'); this.showEditModal = false; this.loadTransactions(); },
        error: (err) => { this.toastService.error(err.error?.error || 'Failed to update.'); this.editSubmitting = false; },
      });
    }
  }

  // --- Delete (all row types) ---
  confirmDeleteRow(txn: TransactionDto): void {
    this.deleteTarget = txn;
    this.deleteSubmitting = false;
    this.showDeleteModal = true;
  }

  executeDelete(): void {
    if (!this.deleteTarget) return;
    this.deleteSubmitting = true;
    let obs;
    if (this.deleteTarget.rowType === 'income') obs = this.apiService.deleteIncome(this.deleteTarget.id);
    else if (this.deleteTarget.rowType === 'bonus') obs = this.apiService.deleteBonus(this.deleteTarget.id);
    else obs = this.apiService.deleteTransaction(this.deleteTarget.id);

    obs.subscribe({
      next: () => {
        const label = this.deleteTarget?.rowType === 'income' ? 'Income' : this.deleteTarget?.rowType === 'bonus' ? 'Bonus' : 'Transaction';
        this.toastService.success(`${label} deleted.`);
        this.showDeleteModal = false;
        this.deleteTarget = null;
        this.loadTransactions();
      },
      error: () => { this.toastService.error('Failed to delete.'); this.deleteSubmitting = false; },
    });
  }

  // --- Attachments (all row types) ---
  openAttachmentModal(txn: TransactionDto): void {
    this.attachmentEntityType = txn.rowType;
    this.attachmentEntityId = txn.id;
    this.selectedFile = null;
    this.uploadError = '';
    this.showAttachmentModal = true;
    this.loadAttachments();
  }

  loadAttachments(): void {
    this.apiService.getAttachments(this.attachmentEntityId, this.attachmentEntityType).subscribe({
      next: (res) => { this.attachments = res.attachments; },
      error: () => { this.attachments = []; },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files && input.files.length > 0 ? input.files[0] : null;
    this.uploadError = '';
  }

  uploadFile(): void {
    if (!this.selectedFile) return;
    this.uploading = true;
    this.uploadError = '';
    this.apiService.uploadAttachment(this.attachmentEntityId, this.selectedFile, this.attachmentEntityType).subscribe({
      next: () => {
        this.uploading = false;
        this.selectedFile = null;
        this.loadAttachments();
        this.loadTransactions();
        this.toastService.success('Attachment uploaded.');
      },
      error: (err) => { this.uploading = false; this.uploadError = err.error?.error || 'Upload failed.'; },
    });
  }

  deleteAttachment(id: number): void {
    this.apiService.deleteAttachment(id).subscribe({
      next: () => { this.loadAttachments(); this.loadTransactions(); this.toastService.success('Attachment deleted.'); },
      error: () => { this.toastService.error('Failed to delete attachment.'); },
    });
  }

  viewAttachment(id: number, contentType: string): void {
    this.apiService.downloadAttachment(id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      },
      error: () => { this.toastService.error('Failed to open attachment.'); },
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
