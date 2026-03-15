import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardResponse } from '../../core/models/dashboard.model';
import { ToastService } from '../../shared/components/toast/toast.service';
import { AudCurrencyPipe } from '../../shared/pipes/currency-aud.pipe';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { RecurringItem } from '../../core/models/recurring.model';
import { TransactionsComponent } from '../transactions/transactions.component';

interface FlatEnvelope {
  id: number;
  name: string;
  groupName: string;
  budgetFn: number;
  ticker: string | null;
}

interface EnvelopeGroupSetting {
  groupName: string;
  envelopes: FlatEnvelope[];
  totalBudgetFn: number;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, AudCurrencyPipe, TransactionsComponent],
  template: `
    <div>
      <h1 class="text-2xl font-bold text-slate-800 mb-6">Settings</h1>

      <!-- Change Password -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 mb-6">
        <div class="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">Change Password</div>
        <div class="p-5">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label class="form-label">Current Password</label>
              <input type="password" class="form-control" [(ngModel)]="currentPassword" />
            </div>
            <div>
              <label class="form-label">New Password</label>
              <input type="password" class="form-control" [(ngModel)]="newPassword" />
            </div>
            <div>
              <label class="form-label">Confirm Password</label>
              <input type="password" class="form-control" [(ngModel)]="confirmPassword" />
            </div>
            <div>
              <button class="btn btn-primary" (click)="changePassword()" [disabled]="changingPassword">
                @if (changingPassword) {
                  <span class="spinner-border spinner-border-sm me-1"></span>
                }
                Change Password
              </button>
            </div>
          </div>
          @if (passwordMessage) {
            <div class="mt-3 text-sm" [class.text-ok]="passwordMessageType === 'success'" [class.text-over]="passwordMessageType === 'error'">
              {{ passwordMessage }}
            </div>
          }
        </div>
      </div>

      <!-- Pay Cycle Settings -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 mb-6">
        <div class="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">Pay Cycle Settings</div>
        <div class="p-5">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label class="form-label">Pay Cycle Start Date</label>
              <input type="date" class="form-control" [(ngModel)]="payCycleStart" />
            </div>
            <div>
              <button class="btn btn-primary" (click)="savePaySettings()" [disabled]="savingSettings">
                @if (savingSettings) {
                  <span class="spinner-border spinner-border-sm me-1"></span>
                }
                Save Settings
              </button>
            </div>
          </div>
          @if (settingsMessage) {
            <div class="mt-3 text-sm" [class.text-ok]="settingsMessageType === 'success'" [class.text-over]="settingsMessageType === 'error'">
              {{ settingsMessage }}
            </div>
          }
        </div>
      </div>

      <!-- Recurring Items -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 mb-6">
        <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <span class="font-semibold text-slate-800">Recurring Items</span>
          <button class="btn btn-success btn-sm" (click)="openAddRecurringModal()">+ Add Recurring</button>
        </div>
        <div class="p-0">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-800 text-white">
                <tr>
                  <th class="px-4 py-3">Type</th>
                  <th class="px-4 py-3">Details</th>
                  <th class="px-4 py-3 text-end" style="width: 100px;">Amount</th>
                  <th class="px-4 py-3" style="width: 100px;">Frequency</th>
                  <th class="px-4 py-3 whitespace-nowrap">Next Date</th>
                  <th class="px-4 py-3 text-center" style="width: 80px;">Status</th>
                  <th class="px-4 py-3 text-center" style="width: 150px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (item of recurringItems; track item.id) {
                  <tr [class.text-slate-500]="!item.active" class="cursor-pointer" (click)="openRecurringRecordsModal(item)">
                    <td class="px-4 py-2.5">
                      @if (item.type === 'Income') {
                        {{ item.incomeType }}
                      } @else {
                        Expense
                      }
                      @if (item.isSystem) {
                        <span class="badge bg-info ms-1">System</span>
                      }
                    </td>
                    <td class="px-4 py-2.5">
                      @if (item.type === 'Expense' && item.envelopeName) {
                        {{ item.envelopeGroupName }} &gt; {{ item.envelopeName }}
                      }
                      @if (item.description) {
                        <span class="text-slate-400 text-xs ml-1">{{ item.description }}</span>
                      }
                    </td>
                    <td class="px-4 py-2.5 text-end">{{ item.amount | aud }}</td>
                    <td class="px-4 py-2.5">{{ item.frequency }}</td>
                    <td class="px-4 py-2.5 whitespace-nowrap">
                      @if (item.nextDate) {
                        {{ item.nextDate }}
                      } @else {
                        <span class="text-slate-400">&#8211;</span>
                      }
                    </td>
                    <td class="px-4 py-2.5 text-center">
                      @if (item.active) {
                        Active
                      } @else {
                        Paused
                      }
                    </td>
                    <td class="px-4 py-2.5 text-center" (click)="$event.stopPropagation()">
                      <div class="flex gap-1">
                        <button class="btn btn-outline-primary" title="Edit" (click)="openEditRecurringModal(item)">
                          <i class="bi bi-pencil d-md-none"></i><span class="hidden md:inline">Edit</span>
                        </button>
                        <button class="btn btn-outline-secondary" [title]="item.active ? 'Pause' : 'Resume'" (click)="toggleRecurring(item)">
                          <i class="bi d-md-none" [class.bi-pause-fill]="item.active" [class.bi-play-fill]="!item.active"></i><span class="hidden md:inline">{{ item.active ? 'Pause' : 'Resume' }}</span>
                        </button>
                        @if (!item.isSystem) {
                          <button class="btn btn-outline-danger" title="Delete" (click)="deleteRecurring(item)">
                            <i class="bi bi-x-lg d-md-none"></i><span class="hidden md:inline">Delete</span>
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="text-center text-slate-500 py-6">No recurring items. Add one to auto-generate income or expenses.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Add Recurring Modal -->
      @if (showAddRecurringModal) {
        <div class="modal-backdrop fade show"></div>
        <div class="modal fade show d-block" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Add Recurring Item</h5>
                <button type="button" class="btn-close" (click)="showAddRecurringModal = false"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">Type</label>
                  <select class="form-select" [(ngModel)]="addRecurringForm.type" (ngModelChange)="onRecurringTypeChange()">
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                  </select>
                </div>
                @if (addRecurringForm.type === 'Income') {
                  <div class="mb-3">
                    <label class="form-label">Income Type</label>
                    <select class="form-select" [(ngModel)]="addRecurringForm.incomeType">
                      <option value="Paycheck">Paycheck</option>
                      <option value="Bonus">Bonus</option>
                    </select>
                  </div>
                }
                @if (addRecurringForm.type === 'Expense') {
                  <div class="mb-3">
                    <label class="form-label">Envelope</label>
                    <select class="form-select" [(ngModel)]="addRecurringForm.envelopeId">
                      @for (env of flatEnvelopes; track env.id) {
                        <option [ngValue]="env.id">{{ env.groupName }} &gt; {{ env.name }}</option>
                      }
                    </select>
                  </div>
                }
                <div class="mb-3">
                  <label class="form-label">Amount</label>
                  <input type="number" step="0.01" min="0.01" class="form-control" [(ngModel)]="addRecurringForm.amount" />
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label class="form-label">Start Date</label>
                    <input type="date" class="form-control" [(ngModel)]="addRecurringForm.startDate" />
                  </div>
                  <div>
                    <label class="form-label">Frequency</label>
                    <select class="form-select" [(ngModel)]="addRecurringForm.frequency">
                      <option value="Fortnightly">Fortnightly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Description</label>
                  <input type="text" class="form-control" [(ngModel)]="addRecurringForm.description" placeholder="Optional" />
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" (click)="showAddRecurringModal = false">Cancel</button>
                <button class="btn btn-primary" (click)="submitAddRecurring()" [disabled]="addRecurringSubmitting">
                  @if (addRecurringSubmitting) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  Add Recurring
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Edit Recurring Modal -->
      @if (showEditRecurringModal) {
        <div class="modal-backdrop fade show"></div>
        <div class="modal fade show d-block" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Edit Recurring Item</h5>
                <button type="button" class="btn-close" (click)="showEditRecurringModal = false"></button>
              </div>
              <div class="modal-body">
                @if (!editRecurringIsSystem) {
                  @if (editRecurringType === 'Income') {
                    <div class="mb-3">
                      <label class="form-label">Income Type</label>
                      <select class="form-select" [(ngModel)]="editRecurringForm.incomeType">
                        <option value="Paycheck">Paycheck</option>
                        <option value="Bonus">Bonus</option>
                      </select>
                    </div>
                  }
                  @if (editRecurringType === 'Expense') {
                    <div class="mb-3">
                      <label class="form-label">Envelope</label>
                      <select class="form-select" [(ngModel)]="editRecurringForm.envelopeId">
                        @for (env of flatEnvelopes; track env.id) {
                          <option [ngValue]="env.id">{{ env.groupName }} &gt; {{ env.name }}</option>
                        }
                      </select>
                    </div>
                  }
                }
                <div class="mb-3">
                  <label class="form-label">Amount</label>
                  <input type="number" step="0.01" min="0.01" class="form-control" [(ngModel)]="editRecurringForm.amount" />
                </div>
                @if (!editRecurringIsSystem) {
                  <div class="mb-3">
                    <label class="form-label">Frequency</label>
                    <select class="form-select" [(ngModel)]="editRecurringForm.frequency">
                      <option value="Fortnightly">Fortnightly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                }
                <div class="mb-3">
                  <label class="form-label">Description</label>
                  <input type="text" class="form-control" [(ngModel)]="editRecurringForm.description" placeholder="Optional" />
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" (click)="showEditRecurringModal = false">Cancel</button>
                <button class="btn btn-primary" (click)="submitEditRecurring()" [disabled]="editRecurringSubmitting">
                  @if (editRecurringSubmitting) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Recurring Records Modal -->
      @if (showRecurringRecordsModal) {
        <div class="modal-backdrop fade show"></div>
        <div class="modal fade show d-block" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">
                  Records for: {{ recurringRecordsItem?.description || recurringRecordsItem?.incomeType || 'Recurring Item' }}
                </h5>
                <button type="button" class="btn-close" (click)="showRecurringRecordsModal = false"></button>
              </div>
              <div class="modal-body p-0">
                <app-transactions [recurringItemId]="recurringRecordsItem!.id"></app-transactions>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary btn-sm" (click)="showRecurringRecordsModal = false">Close</button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Envelopes -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 mb-6">
        <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <span class="font-semibold text-slate-800">Envelopes</span>
          <button class="btn btn-success btn-sm" (click)="openAddEnvelopeModal()">+ Add Envelope</button>
        </div>
        <div class="p-0">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-800 text-white">
                <tr>
                  <th class="px-4 py-3">Envelope</th>
                  <th class="px-4 py-3 text-end" style="width: 160px;">Budget / fn</th>
                  <th class="px-4 py-3 text-end" style="width: 140px;">Annual (x26)</th>
                  <th class="px-4 py-3 text-center" style="width: 140px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (group of groupedEnvelopes; track group.groupName) {
                  <!-- Group Header -->
                  <tr class="bg-slate-50 border-t border-slate-200">
                    <td class="px-4 py-2.5 font-semibold text-slate-700">{{ group.groupName }}</td>
                    <td class="px-4 py-2.5 text-end font-semibold text-slate-700">{{ group.totalBudgetFn | aud }}</td>
                    <td class="px-4 py-2.5 text-end font-semibold text-slate-700">{{ group.totalBudgetFn * 26 | aud }}</td>
                    <td></td>
                  </tr>
                  <!-- Envelopes in Group -->
                  @for (env of group.envelopes; track env.id) {
                    <tr class="hover:bg-slate-50/50 transition-colors">
                      <td class="px-4 py-2.5 pl-8">{{ env.name }}</td>
                      <td class="px-4 py-2.5 text-end budget-cell cursor-pointer" (click)="startInlineEdit(env)">
                        @if (inlineEditId === env.id) {
                          <input
                            type="number"
                            step="0.01"
                            class="form-control form-control-sm text-end"
                            [(ngModel)]="inlineEditValue"
                            (blur)="saveInlineEdit(env)"
                            (keydown.enter)="saveInlineEdit(env)"
                            (keydown.escape)="cancelInlineEdit()"
                            #inlineInput
                          />
                        } @else {
                          {{ env.budgetFn | aud }}
                        }
                      </td>
                      <td class="px-4 py-2.5 text-end">{{ env.budgetFn * 26 | aud }}</td>
                      <td class="px-4 py-2.5 text-center">
                        <div class="flex gap-1">
                          <button class="btn btn-outline-primary" title="Edit" (click)="openEditEnvelopeModal(env)">
                            <i class="bi bi-pencil d-md-none"></i><span class="hidden md:inline">Edit</span>
                          </button>
                          <button class="btn btn-outline-danger" title="Delete" (click)="confirmDeleteEnvelope(env)">
                            <i class="bi bi-x-lg d-md-none"></i><span class="hidden md:inline">Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                } @empty {
                  <tr>
                    <td colspan="4" class="text-center text-slate-500 py-6">No envelopes configured.</td>
                  </tr>
                }
                @if (flatEnvelopes.length > 0) {
                  <tr class="bg-slate-100 border-t-2 border-slate-300">
                    <td class="px-4 py-3"><span class="font-bold text-slate-800">Total</span></td>
                    <td class="px-4 py-3 text-end"><span class="font-bold text-slate-800">{{ totalBudgetFn | aud }}</span></td>
                    <td class="px-4 py-3 text-end"><span class="font-bold text-slate-800">{{ totalBudgetFn * 26 | aud }}</span></td>
                    <td></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Add Envelope Modal -->
      @if (showAddEnvelopeModal) {
        <div class="modal-backdrop fade show"></div>
        <div class="modal fade show d-block" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Add Envelope</h5>
                <button type="button" class="btn-close" (click)="showAddEnvelopeModal = false"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">Group</label>
                  <select class="form-select" [(ngModel)]="addEnvForm.groupSelection" (ngModelChange)="onGroupSelectionChange()">
                    @for (g of existingGroups; track g) {
                      <option [ngValue]="g">{{ g }}</option>
                    }
                    <option value="__new__">+ New Group...</option>
                  </select>
                </div>
                @if (addEnvForm.groupSelection === '__new__') {
                  <div class="mb-3">
                    <label class="form-label">New Group Name</label>
                    <input type="text" class="form-control" [(ngModel)]="addEnvForm.newGroupName" />
                  </div>
                }
                <div class="mb-3 position-relative">
                  <label class="form-label">
                    @if (isInvestmentGroup) {
                      Search Ticker
                    } @else {
                      Name
                    }
                  </label>
                  <input
                    type="text"
                    class="form-control"
                    [(ngModel)]="addEnvForm.name"
                    (ngModelChange)="onNameInput($event)"
                    [placeholder]="isInvestmentGroup ? 'Type to search tickers...' : 'Envelope name'"
                    autocomplete="off"
                  />
                  @if (isInvestmentGroup && tickerResults.length > 0 && showTickerDropdown) {
                    <div class="ticker-dropdown">
                      @for (t of tickerResults; track t.ticker) {
                        <div class="ticker-item" (click)="selectTicker(t)">
                          <span class="font-semibold text-slate-800">{{ t.ticker }}</span>
                          <span class="ticker-name ms-2">{{ t.name }}</span>
                          <span class="ticker-exchange ms-2">{{ t.exchange }}</span>
                        </div>
                      }
                    </div>
                  }
                </div>
                @if (isInvestmentGroup && addEnvForm.ticker) {
                  <div class="mb-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Ticker: {{ addEnvForm.ticker }}</span>
                  </div>
                }
                <div class="mb-3">
                  <label class="form-label">Budget / fn</label>
                  <input type="number" step="0.01" class="form-control" [(ngModel)]="addEnvForm.budgetFn" />
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" (click)="showAddEnvelopeModal = false">Cancel</button>
                <button class="btn btn-primary" (click)="submitAddEnvelope()" [disabled]="addEnvSubmitting">
                  @if (addEnvSubmitting) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  Create Envelope
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Edit Envelope Modal -->
      @if (showEditEnvelopeModal) {
        <div class="modal-backdrop fade show"></div>
        <div class="modal fade show d-block" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Edit Envelope</h5>
                <button type="button" class="btn-close" (click)="showEditEnvelopeModal = false"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">Name</label>
                  <input type="text" class="form-control" [(ngModel)]="editEnvForm.name" />
                </div>
                <div class="mb-3">
                  <label class="form-label">Group</label>
                  <input type="text" class="form-control" [(ngModel)]="editEnvForm.groupName" />
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" (click)="showEditEnvelopeModal = false">Cancel</button>
                <button class="btn btn-primary" (click)="submitEditEnvelope()" [disabled]="editEnvSubmitting">
                  @if (editEnvSubmitting) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Delete Envelope Confirmation Modal -->
      @if (showDeleteEnvelopeModal) {
        <div class="modal-backdrop fade show"></div>
        <div class="modal fade show d-block" tabindex="-1">
          <div class="modal-dialog modal-sm">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Delete Envelope</h5>
                <button type="button" class="btn-close" (click)="showDeleteEnvelopeModal = false"></button>
              </div>
              <div class="modal-body">
                <p>Are you sure you want to delete <span class="font-semibold text-slate-800">{{ deleteEnvTarget?.name }}</span>?</p>
                @if (deleteEnvTxnCount > 0) {
                  <p class="text-danger small">This envelope has {{ deleteEnvTxnCount }} transaction(s) that will also be removed.</p>
                }
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary btn-sm" (click)="showDeleteEnvelopeModal = false">Cancel</button>
                <button class="btn btn-danger btn-sm" (click)="executeDeleteEnvelope()" [disabled]="deleteEnvSubmitting">
                  @if (deleteEnvSubmitting) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Inline Edit Confirmation Modal -->
      @if (showInlineConfirmModal) {
        <div class="modal-backdrop fade show"></div>
        <div class="modal fade show d-block" tabindex="-1">
          <div class="modal-dialog modal-sm">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Update Budget</h5>
                <button type="button" class="btn-close" (click)="cancelInlineConfirm()"></button>
              </div>
              <div class="modal-body">
                <p>
                  Change budget for <span class="font-semibold text-slate-800">{{ inlineConfirmEnv?.name }}</span>
                  from {{ inlineConfirmOldValue | aud }} to {{ inlineEditValue | aud }}?
                </p>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary btn-sm" (click)="cancelInlineConfirm()">Cancel</button>
                <button class="btn btn-primary btn-sm" (click)="confirmInlineEdit()" [disabled]="inlineSaving">
                  @if (inlineSaving) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  // Pay Cycle Settings
  payCycleStart = '';
  savingSettings = false;
  settingsMessage = '';
  settingsMessageType: 'success' | 'error' = 'success';

  // Change Password
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  changingPassword = false;
  passwordMessage = '';
  passwordMessageType: 'success' | 'error' = 'success';

  // Ticker Directory
  tickerCount = 0;
  reloadingTickers = false;

  // Envelope list
  flatEnvelopes: FlatEnvelope[] = [];
  groupedEnvelopes: EnvelopeGroupSetting[] = [];
  existingGroups: string[] = [];
  totalBudgetFn = 0;

  // Inline budget editing
  inlineEditId: number | null = null;
  inlineEditValue = 0;
  inlineSaving = false;
  showInlineConfirmModal = false;
  inlineConfirmEnv: FlatEnvelope | null = null;
  inlineConfirmOldValue = 0;

  // Add Envelope Modal
  showAddEnvelopeModal = false;
  addEnvSubmitting = false;
  addEnvForm = {
    groupSelection: '',
    newGroupName: '',
    name: '',
    budgetFn: 0,
    ticker: '',
  };

  // Ticker search
  tickerResults: { ticker: string; name: string; exchange: string }[] = [];
  showTickerDropdown = false;
  private tickerSearchSubject = new Subject<string>();

  // Edit Envelope Modal
  showEditEnvelopeModal = false;
  editEnvSubmitting = false;
  editEnvId = 0;
  editEnvForm = {
    name: '',
    groupName: '',
  };

  // Delete Envelope Modal
  showDeleteEnvelopeModal = false;
  deleteEnvSubmitting = false;
  deleteEnvTarget: FlatEnvelope | null = null;
  deleteEnvTxnCount = 0;

  // Recurring Items
  recurringItems: RecurringItem[] = [];
  showAddRecurringModal = false;
  addRecurringSubmitting = false;
  addRecurringForm = {
    type: 'Income' as 'Income' | 'Expense',
    incomeType: 'Paycheck',
    envelopeId: 0,
    amount: 0,
    description: '',
    startDate: '',
    frequency: 'Fortnightly',
  };

  // Edit Recurring Modal
  showEditRecurringModal = false;
  editRecurringSubmitting = false;
  editRecurringId = 0;
  editRecurringType: 'Income' | 'Expense' = 'Income';
  editRecurringIsSystem = false;
  editRecurringForm = {
    amount: 0,
    description: '',
    envelopeId: 0 as number | undefined,
    incomeType: 'Paycheck',
    frequency: 'Fortnightly',
  };

  // Recurring Records Modal
  showRecurringRecordsModal = false;
  recurringRecordsItem: RecurringItem | null = null;

  get isInvestmentGroup(): boolean {
    const group = this.addEnvForm.groupSelection === '__new__'
      ? this.addEnvForm.newGroupName
      : this.addEnvForm.groupSelection;
    return group.toLowerCase() === 'investments';
  }

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.loadRecurringItems();

    this.tickerSearchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query: string) => {
        if (query.length < 2) {
          this.tickerResults = [];
          this.showTickerDropdown = false;
          return;
        }
        this.apiService.searchTickers(query).subscribe({
          next: (res) => {
            this.tickerResults = res.results;
            this.showTickerDropdown = this.tickerResults.length > 0;
          },
          error: () => {
            this.tickerResults = [];
            this.showTickerDropdown = false;
          },
        });
      });
  }

  loadData(): void {
    this.apiService.getDashboard().subscribe({
      next: (res: DashboardResponse) => {
        this.payCycleStart = res.periodStart;

        this.flatEnvelopes = [];
        this.existingGroups = [];

        // Add expense envelopes from groups
        for (const group of res.groups) {
          if (!this.existingGroups.includes(group.name)) {
            this.existingGroups.push(group.name);
          }
          for (const env of group.envelopes) {
            this.flatEnvelopes.push({
              id: env.id,
              name: env.name,
              groupName: env.groupName,
              budgetFn: env.budgetFn,
              ticker: env.ticker,
            });
          }
        }

        // Add investment envelopes
        if (res.investments && res.investments.envelopes.length > 0) {
          if (!this.existingGroups.includes('Investments')) {
            this.existingGroups.push('Investments');
          }
          for (const inv of res.investments.envelopes) {
            this.flatEnvelopes.push({
              id: inv.id,
              name: inv.name,
              groupName: 'Investments',
              budgetFn: inv.budgetFn,
              ticker: inv.ticker,
            });
          }
        }

        this.totalBudgetFn = this.flatEnvelopes.reduce((sum, e) => sum + e.budgetFn, 0);
        this.buildGroupedEnvelopes();
      },
      error: () => {
        this.toastService.error('Failed to load settings data.');
      },
    });
  }

  private buildGroupedEnvelopes(): void {
    const map = new Map<string, FlatEnvelope[]>();
    for (const env of this.flatEnvelopes) {
      if (!map.has(env.groupName)) map.set(env.groupName, []);
      map.get(env.groupName)!.push(env);
    }
    this.groupedEnvelopes = Array.from(map.entries()).map(([groupName, envelopes]) => ({
      groupName,
      envelopes,
      totalBudgetFn: envelopes.reduce((sum, e) => sum + e.budgetFn, 0),
    }));
  }


  // Pay Cycle Settings
  savePaySettings(): void {
    this.savingSettings = true;
    this.settingsMessage = '';
    this.apiService
      .saveSettings({ payCycleStart: this.payCycleStart })
      .subscribe({
        next: () => {
          this.settingsMessage = 'Settings saved successfully.';
          this.settingsMessageType = 'success';
          this.savingSettings = false;
        },
        error: () => {
          this.settingsMessage = 'Failed to save settings.';
          this.settingsMessageType = 'error';
          this.savingSettings = false;
        },
      });
  }


  changePassword(): void {
    this.passwordMessage = '';
    if (!this.currentPassword) {
      this.passwordMessage = 'Current password is required.';
      this.passwordMessageType = 'error';
      return;
    }
    if (this.newPassword.length < 6) {
      this.passwordMessage = 'New password must be at least 6 characters.';
      this.passwordMessageType = 'error';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordMessage = 'Passwords do not match.';
      this.passwordMessageType = 'error';
      return;
    }
    this.changingPassword = true;
    this.authService.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: (res) => {
        this.passwordMessage = res.message;
        this.passwordMessageType = 'success';
        this.changingPassword = false;
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err) => {
        this.passwordMessage = err.error?.error || 'Failed to change password.';
        this.passwordMessageType = 'error';
        this.changingPassword = false;
      },
    });
  }

  // Inline Budget Editing
  startInlineEdit(env: FlatEnvelope): void {
    this.inlineEditId = env.id;
    this.inlineEditValue = env.budgetFn;
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('.budget-cell input');
      input?.focus();
      input?.select();
    });
  }

  cancelInlineEdit(): void {
    this.inlineEditId = null;
    this.inlineEditValue = 0;
  }

  saveInlineEdit(env: FlatEnvelope): void {
    if (this.inlineEditValue === env.budgetFn) {
      this.cancelInlineEdit();
      return;
    }
    this.inlineConfirmEnv = env;
    this.inlineConfirmOldValue = env.budgetFn;
    this.showInlineConfirmModal = true;
  }

  cancelInlineConfirm(): void {
    this.showInlineConfirmModal = false;
    this.inlineConfirmEnv = null;
    this.cancelInlineEdit();
  }

  confirmInlineEdit(): void {
    if (!this.inlineConfirmEnv) return;
    this.inlineSaving = true;
    const envId = this.inlineConfirmEnv.id;
    this.apiService.updateBudget(envId, this.inlineEditValue).subscribe({
      next: () => {
        this.toastService.success('Budget updated.');
        this.showInlineConfirmModal = false;
        this.inlineConfirmEnv = null;
        this.cancelInlineEdit();
        this.inlineSaving = false;
        this.loadData();
      },
      error: () => {
        this.toastService.error('Failed to update budget.');
        this.inlineSaving = false;
      },
    });
  }

  // Add Envelope
  openAddEnvelopeModal(): void {
    this.addEnvForm = {
      groupSelection: this.existingGroups.length > 0 ? this.existingGroups[0] : '__new__',
      newGroupName: '',
      name: '',
      budgetFn: 0,
      ticker: '',
    };
    this.tickerResults = [];
    this.showTickerDropdown = false;
    this.addEnvSubmitting = false;
    this.showAddEnvelopeModal = true;
  }

  onGroupSelectionChange(): void {
    this.addEnvForm.ticker = '';
    this.addEnvForm.name = '';
    this.tickerResults = [];
    this.showTickerDropdown = false;
  }

  onNameInput(value: string): void {
    if (this.isInvestmentGroup) {
      this.addEnvForm.ticker = '';
      this.tickerSearchSubject.next(value);
    }
  }

  selectTicker(t: { ticker: string; name: string; exchange: string }): void {
    this.addEnvForm.name = `${t.ticker} - ${t.name}`;
    this.addEnvForm.ticker = t.ticker;
    this.showTickerDropdown = false;
    this.tickerResults = [];
  }

  submitAddEnvelope(): void {
    const groupName =
      this.addEnvForm.groupSelection === '__new__'
        ? this.addEnvForm.newGroupName.trim()
        : this.addEnvForm.groupSelection;

    if (!groupName || !this.addEnvForm.name.trim()) {
      this.toastService.error('Please fill in group and name.');
      return;
    }

    this.addEnvSubmitting = true;
    const data: { name: string; groupName: string; budgetFn: number; ticker?: string } = {
      name: this.addEnvForm.name.trim(),
      groupName,
      budgetFn: this.addEnvForm.budgetFn,
    };
    if (this.addEnvForm.ticker) {
      data.ticker = this.addEnvForm.ticker;
    }

    this.apiService.createEnvelope(data).subscribe({
      next: () => {
        this.toastService.success('Envelope created.');
        this.showAddEnvelopeModal = false;
        this.loadData();
      },
      error: () => {
        this.toastService.error('Failed to create envelope.');
        this.addEnvSubmitting = false;
      },
    });
  }

  // Edit Envelope
  openEditEnvelopeModal(env: FlatEnvelope): void {
    this.editEnvId = env.id;
    this.editEnvForm = {
      name: env.name,
      groupName: env.groupName,
    };
    this.editEnvSubmitting = false;
    this.showEditEnvelopeModal = true;
  }

  submitEditEnvelope(): void {
    if (!this.editEnvForm.name.trim() || !this.editEnvForm.groupName.trim()) {
      this.toastService.error('Please fill in name and group.');
      return;
    }
    this.editEnvSubmitting = true;
    this.apiService
      .updateEnvelope(this.editEnvId, {
        name: this.editEnvForm.name.trim(),
        groupName: this.editEnvForm.groupName.trim(),
      })
      .subscribe({
        next: () => {
          this.toastService.success('Envelope updated.');
          this.showEditEnvelopeModal = false;
          this.loadData();
        },
        error: () => {
          this.toastService.error('Failed to update envelope.');
          this.editEnvSubmitting = false;
        },
      });
  }

  // Delete Envelope
  confirmDeleteEnvelope(env: FlatEnvelope): void {
    this.deleteEnvTarget = env;
    this.deleteEnvTxnCount = 0;
    this.deleteEnvSubmitting = false;
    this.showDeleteEnvelopeModal = true;

    this.apiService.getTransactionCount(env.id).subscribe({
      next: (res) => {
        this.deleteEnvTxnCount = res.count;
      },
      error: () => {
        this.deleteEnvTxnCount = 0;
      },
    });
  }

  executeDeleteEnvelope(): void {
    if (!this.deleteEnvTarget) return;
    this.deleteEnvSubmitting = true;
    this.apiService.deleteEnvelope(this.deleteEnvTarget.id).subscribe({
      next: () => {
        this.toastService.success('Envelope deleted.');
        this.showDeleteEnvelopeModal = false;
        this.deleteEnvTarget = null;
        this.loadData();
      },
      error: () => {
        this.toastService.error('Failed to delete envelope.');
        this.deleteEnvSubmitting = false;
      },
    });
  }

  // Recurring Items
  loadRecurringItems(): void {
    this.apiService.getRecurringItems().subscribe({
      next: (res) => {
        this.recurringItems = res.items;
      },
      error: () => {
        this.recurringItems = [];
      },
    });
  }

  openAddRecurringModal(): void {
    const today = new Date().toISOString().split('T')[0];
    this.addRecurringForm = {
      type: 'Income',
      incomeType: 'Paycheck',
      envelopeId: this.flatEnvelopes.length > 0 ? this.flatEnvelopes[0].id : 0,
      amount: 0,
      description: '',
      startDate: today,
      frequency: 'Fortnightly',
    };
    this.addRecurringSubmitting = false;
    this.showAddRecurringModal = true;
  }

  onRecurringTypeChange(): void {
    if (this.addRecurringForm.type === 'Income') {
      this.addRecurringForm.amount = 0;
    } else {
      this.addRecurringForm.amount = 0;
    }
  }

  submitAddRecurring(): void {
    if (this.addRecurringForm.amount <= 0) {
      this.toastService.error('Please enter a positive amount.');
      return;
    }
    if (this.addRecurringForm.type === 'Expense' && !this.addRecurringForm.envelopeId) {
      this.toastService.error('Please select an envelope.');
      return;
    }
    if (!this.addRecurringForm.startDate) {
      this.toastService.error('Please select a start date.');
      return;
    }

    this.addRecurringSubmitting = true;
    const data: { type: string; amount: number; description: string; envelopeId?: number; incomeType?: string; startDate: string; frequency: string } = {
      type: this.addRecurringForm.type,
      amount: this.addRecurringForm.amount,
      description: this.addRecurringForm.description,
      startDate: this.addRecurringForm.startDate,
      frequency: this.addRecurringForm.frequency,
    };
    if (this.addRecurringForm.type === 'Income') {
      data.incomeType = this.addRecurringForm.incomeType;
    } else {
      data.envelopeId = this.addRecurringForm.envelopeId;
    }

    this.apiService.createRecurring(data).subscribe({
      next: () => {
        this.toastService.success('Recurring item created.');
        this.showAddRecurringModal = false;
        this.loadRecurringItems();
      },
      error: (err) => {
        this.toastService.error(err.error?.error || 'Failed to create recurring item.');
        this.addRecurringSubmitting = false;
      },
    });
  }

  toggleRecurring(item: RecurringItem): void {
    this.apiService.toggleRecurring(item.id).subscribe({
      next: (res) => {
        item.active = res.active;
        this.toastService.success(res.active ? 'Recurring item resumed.' : 'Recurring item paused.');
      },
      error: () => {
        this.toastService.error('Failed to update recurring item.');
      },
    });
  }

  deleteRecurring(item: RecurringItem): void {
    this.apiService.deleteRecurring(item.id).subscribe({
      next: () => {
        this.toastService.success('Recurring item deleted.');
        this.loadRecurringItems();
      },
      error: () => {
        this.toastService.error('Failed to delete recurring item.');
      },
    });
  }

  // Edit Recurring
  openEditRecurringModal(item: RecurringItem): void {
    this.editRecurringId = item.id;
    this.editRecurringType = item.type;
    this.editRecurringIsSystem = item.isSystem;
    this.editRecurringForm = {
      amount: item.amount,
      description: item.description,
      envelopeId: item.envelopeId ?? undefined,
      incomeType: item.incomeType ?? 'Paycheck',
      frequency: item.frequency,
    };
    this.editRecurringSubmitting = false;
    this.showEditRecurringModal = true;
  }

  submitEditRecurring(): void {
    if (this.editRecurringForm.amount <= 0) {
      this.toastService.error('Please enter a positive amount.');
      return;
    }
    this.editRecurringSubmitting = true;
    const data: { amount: number; description?: string; envelopeId?: number; incomeType?: string; frequency: string } = {
      amount: this.editRecurringForm.amount,
      description: this.editRecurringForm.description,
      frequency: this.editRecurringForm.frequency,
    };
    if (this.editRecurringType === 'Income') {
      data.incomeType = this.editRecurringForm.incomeType;
    } else {
      data.envelopeId = this.editRecurringForm.envelopeId;
    }
    this.apiService.updateRecurring(this.editRecurringId, data).subscribe({
      next: () => {
        this.toastService.success('Recurring item updated.');
        this.showEditRecurringModal = false;
        this.loadRecurringItems();
      },
      error: (err) => {
        this.toastService.error(err.error?.error || 'Failed to update recurring item.');
        this.editRecurringSubmitting = false;
      },
    });
  }

  // Recurring Records
  openRecurringRecordsModal(item: RecurringItem): void {
    this.recurringRecordsItem = item;
    this.showRecurringRecordsModal = true;
  }
}
