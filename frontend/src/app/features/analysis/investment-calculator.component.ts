import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AudCurrencyPipe } from '../../shared/pipes/currency-aud.pipe';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface ProjectionPoint {
  year: number;
  contributed: number;
  value: number;
  growth: number;
}

@Component({
  selector: 'app-investment-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, AudCurrencyPipe],
  template: `
    <div class="mb-3">
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 mb-4">
        <div class="px-6 py-4 border-b border-slate-100"><span class="font-semibold text-slate-800">Investment Growth Calculator</span></div>
        <div class="p-6">
          <p class="text-slate-500 text-sm mb-4">
            Projects how your investment envelopes will grow over time based on your current fortnightly contributions.
            Adjust the expected annual return to see different scenarios.
          </p>

          <!-- Input Parameters -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label class="form-label text-sm"><strong>Fortnightly Contribution</strong></label>
              <div class="input-group input-group-sm">
                <span class="input-group-text">$</span>
                <input type="number" class="form-control" [(ngModel)]="fortnightlyContribution"
                       (ngModelChange)="recalculate()" step="50" min="0">
              </div>
              <div class="text-xs text-slate-400 mt-1">From your investment envelopes</div>
            </div>
            <div>
              <label class="form-label text-sm"><strong>Expected Annual Return (%)</strong></label>
              <div class="input-group input-group-sm">
                <input type="number" class="form-control" [(ngModel)]="annualReturn"
                       (ngModelChange)="recalculate()" step="0.5" min="0" max="30">
                <span class="input-group-text">%</span>
              </div>
              <div class="text-xs text-slate-400 mt-1">Historical avg: 7-10% for diversified ETFs</div>
            </div>
            <div>
              <label class="form-label text-sm"><strong>Starting Balance</strong></label>
              <div class="input-group input-group-sm">
                <span class="input-group-text">$</span>
                <input type="number" class="form-control" [(ngModel)]="startingBalance"
                       (ngModelChange)="recalculate()" step="100" min="0">
              </div>
              <div class="text-xs text-slate-400 mt-1">Current portfolio cost basis</div>
            </div>
            <div>
              <label class="form-label text-sm"><strong>Annual Increase (%)</strong></label>
              <div class="input-group input-group-sm">
                <input type="number" class="form-control" [(ngModel)]="contributionIncrease"
                       (ngModelChange)="recalculate()" step="0.5" min="0" max="20">
                <span class="input-group-text">%</span>
              </div>
              <div class="text-xs text-slate-400 mt-1">Yearly increase to contributions</div>
            </div>
          </div>

          <!-- Scenario Buttons -->
          <div class="mb-3">
            <span class="text-sm text-slate-500 mr-2">Scenarios:</span>
            <button class="btn btn-outline-secondary btn-sm me-1" (click)="setScenario('conservative')">Conservative (5%)</button>
            <button class="btn btn-outline-primary btn-sm me-1" (click)="setScenario('moderate')">Moderate (7.5%)</button>
            <button class="btn btn-outline-success btn-sm me-1" (click)="setScenario('growth')">Growth (10%)</button>
            <button class="btn btn-outline-warning btn-sm" (click)="setScenario('aggressive')">Aggressive (12%)</button>
          </div>
        </div>
      </div>

      <!-- Milestone Cards -->
      @if (projections.length > 0) {
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          @for (m of milestones; track m.year) {
            <div>
              <div class="bg-white rounded-xl shadow-sm border border-slate-100 h-full">
                <div class="p-4 text-center">
                  <div class="text-sm text-slate-500 mb-1">In {{ m.year }} Years</div>
                  <div class="text-xl font-bold text-ok">{{ m.value | aud }}</div>
                  <div class="text-xs text-slate-400 mt-1">
                    Contributed: {{ m.contributed | aud }}
                  </div>
                  <div class="small" [class.text-success]="m.growth > 0">
                    Growth: {{ m.growth | aud }} ({{ m.growthPct }}%)
                  </div>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Growth Chart -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 mb-4">
          <div class="px-6 py-4 border-b border-slate-100"><span class="font-semibold text-slate-800">Projected Growth Over Time</span></div>
          <div class="p-6" style="height:350px">
            <canvas id="projectionChart"></canvas>
          </div>
        </div>

        <!-- Detailed Projection Table -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 mb-4">
          <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <strong>Year-by-Year Projection</strong>
            <button class="btn btn-outline-secondary btn-sm" (click)="showAllYears = !showAllYears">
              {{ showAllYears ? 'Show Key Years' : 'Show All Years' }}
            </button>
          </div>
          <div class="p-0" style="max-height:400px;overflow-y:auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50" style="position:sticky;top:0">
                <tr>
                  <th>Year</th>
                  <th class="text-end">Age</th>
                  <th class="text-end">Fortnightly</th>
                  <th class="text-end">Annual Contribution</th>
                  <th class="text-end">Total Contributed</th>
                  <th class="text-end">Portfolio Value</th>
                  <th class="text-end">Total Growth</th>
                  <th class="text-end">Growth %</th>
                </tr>
              </thead>
              <tbody>
                @for (p of displayedProjections; track p.year) {
                  <tr [class.bg-blue-50]="isKeyYear(p.year)">
                    <td>{{ p.year }}</td>
                    <td class="text-end">{{ currentAge + p.year }}</td>
                    <td class="text-end">{{ p.fortnightly | aud }}</td>
                    <td class="text-end">{{ p.annualContribution | aud }}</td>
                    <td class="text-end">{{ p.contributed | aud }}</td>
                    <td class="text-end fw-bold text-success">{{ p.value | aud }}</td>
                    <td class="text-end text-success">{{ p.growth | aud }}</td>
                    <td class="text-end">{{ p.growthPct }}%</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Motivation Section -->
        <div class="bg-green-50 rounded-xl border border-green-200 mb-4">
          <div class="p-6 text-center">
            <h3 class="text-lg font-bold text-ok mb-2">Stay the Course!</h3>
            <p class="mb-1">
              By investing <strong>{{ fortnightlyContribution | aud }}</strong> every fortnight,
              your portfolio could grow to <strong class="text-success">{{ projections[projections.length - 1]?.value | aud }}</strong>
              in {{ maxYears }} years.
            </p>
            <p class="text-slate-500 text-sm mb-0">
              That's <strong>{{ projections[projections.length - 1]?.growth | aud }}</strong> in growth alone -
              {{ projections[projections.length - 1]?.growthPct }}% return on your contributions.
              Compound interest is the eighth wonder of the world!
            </p>
          </div>
        </div>
      }
    </div>
  `,
})
export class InvestmentCalculatorComponent implements OnInit, OnDestroy {
  fortnightlyContribution = 0;
  annualReturn = 8;
  startingBalance = 0;
  contributionIncrease = 0;
  currentAge = 29;
  maxYears = 40;
  showAllYears = false;

  projections: any[] = [];
  milestones: any[] = [];
  private chart: Chart | null = null;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.apiService.getInvestmentProjection().subscribe({
      next: (data) => {
        this.fortnightlyContribution = data.totalFortnightlyContribution;
        this.startingBalance = data.investments.reduce((sum: number, i: any) => sum + i.costBasis, 0);
        this.recalculate();
      },
    });
  }

  ngOnDestroy(): void {
    if (this.chart) { this.chart.destroy(); this.chart = null; }
  }

  setScenario(scenario: string): void {
    switch (scenario) {
      case 'conservative': this.annualReturn = 5; break;
      case 'moderate': this.annualReturn = 7.5; break;
      case 'growth': this.annualReturn = 10; break;
      case 'aggressive': this.annualReturn = 12; break;
    }
    this.recalculate();
  }

  isKeyYear(year: number): boolean {
    return [1, 5, 10, 15, 20, 25, 30, 35, 40].includes(year);
  }

  get displayedProjections() {
    if (this.showAllYears) return this.projections;
    return this.projections.filter(p => this.isKeyYear(p.year));
  }

  recalculate(): void {
    const r = this.annualReturn / 100;
    const fortnightlyRate = Math.pow(1 + r, 1 / 26) - 1;
    let balance = this.startingBalance;
    let totalContributed = this.startingBalance;
    let currentFortnight = this.fortnightlyContribution;

    this.projections = [];

    for (let year = 1; year <= this.maxYears; year++) {
      // 26 fortnights per year
      for (let fn = 0; fn < 26; fn++) {
        balance = balance * (1 + fortnightlyRate) + currentFortnight;
        totalContributed += currentFortnight;
      }

      const growth = balance - totalContributed;
      const growthPct = totalContributed > 0 ? ((growth / totalContributed) * 100).toFixed(1) : '0.0';

      this.projections.push({
        year,
        fortnightly: Math.round(currentFortnight),
        annualContribution: Math.round(currentFortnight * 26),
        contributed: Math.round(totalContributed),
        value: Math.round(balance),
        growth: Math.round(growth),
        growthPct,
      });

      // Apply annual increase to contribution
      if (this.contributionIncrease > 0) {
        currentFortnight *= (1 + this.contributionIncrease / 100);
      }
    }

    // Set milestones
    const milestoneYears = [5, 10, 20, 30];
    this.milestones = milestoneYears
      .filter(y => y <= this.maxYears)
      .map(y => this.projections.find(p => p.year === y))
      .filter(Boolean);

    setTimeout(() => this.buildChart(), 0);
  }

  private buildChart(): void {
    if (this.chart) { this.chart.destroy(); this.chart = null; }
    const canvas = document.getElementById('projectionChart') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.projections.map(p => 'Year ' + p.year),
        datasets: [
          {
            label: 'Portfolio Value',
            data: this.projections.map(p => p.value),
            borderColor: '#198754',
            backgroundColor: 'rgba(25, 135, 84, 0.1)',
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Total Contributed',
            data: this.projections.map(p => p.contributed),
            borderColor: '#6c757d',
            backgroundColor: 'rgba(108, 117, 125, 0.05)',
            fill: true,
            borderDash: [5, 5],
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => {
                const n = Number(v);
                if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
                if (n >= 1000) return '$' + (n / 1000).toFixed(0) + 'K';
                return '$' + n;
              },
            },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed.y;
                return ctx.dataset.label + ': $' + v.toLocaleString();
              },
            },
          },
        },
      },
    });
  }
}
