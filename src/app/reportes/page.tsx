'use client';

import { useState } from 'react';
import { staffApi, type StockReportRow, type SalesReport, type ProductionReport } from '@/lib/api';
import { BarChart3, Package, Factory, Download } from 'lucide-react';

type ReportTab = 'stock' | 'sales' | 'production';

export default function ReportesPage() {
  const [tab, setTab] = useState<ReportTab>('stock');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const [stockData, setStockData] = useState<StockReportRow[] | null>(null);
  const [salesData, setSalesData] = useState<SalesReport | null>(null);
  const [productionData, setProductionData] = useState<ProductionReport | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadReport() {
    setLoading(true);
    try {
      if (tab === 'stock') {
        setStockData(await staffApi.getStockReport());
      } else if (tab === 'sales') {
        setSalesData(await staffApi.getSalesReport({ dateFrom, dateTo }));
      } else {
        setProductionData(await staffApi.getProductionReport({ dateFrom, dateTo }));
      }
    } catch { /* silenced */ }
    finally { setLoading(false); }
  }

  function exportCSV() {
    let csv = '';
    if (tab === 'stock' && stockData) {
      csv = 'SKU,Producto,Ubicación,Cantidad,Umbral,Bajo\n' +
        stockData.map((r) => `${r.sku},${r.productName},${r.locationName},${r.quantity},${r.threshold},${r.isLow}`).join('\n');
    } else if (tab === 'sales' && salesData) {
      csv = 'Fecha,Pedidos,Ingresos (S/)\n' +
        salesData.ordersByDay.map((d) => `${d.date},${d.count},${(d.revenueCents / 100).toFixed(2)}`).join('\n');
    } else if (tab === 'production' && productionData) {
      csv = 'Proceso,Órdenes,Producido (kg),Merma (kg)\n' +
        productionData.byProcess.map((p) => `${p.process},${p.count},${p.producedKg},${p.wasteKg}`).join('\n');
    }
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `reporte-${tab}-${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const tabs: { key: ReportTab; label: string; icon: React.ReactNode }[] = [
    { key: 'stock', label: 'Stock', icon: <Package className="w-4 h-4" /> },
    { key: 'sales', label: 'Ventas', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'production', label: 'Producción', icon: <Factory className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6" data-testid="reportes-page">
      <h1 className="text-2xl font-display font-bold text-gray-900">Reportes</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === t.key ? 'bg-brand-light text-brand-primary border-b-2 border-brand-primary' : 'text-gray-500 hover:text-gray-700'}`} data-testid={`report-tab-${t.key}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Date filters (for sales and production) */}
      {tab !== 'stock' && (
        <div className="flex gap-3 items-center">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="report-date-from" />
          <span className="text-gray-400">→</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="report-date-to" />
        </div>
      )}

      {/* Load + Export */}
      <div className="flex gap-3">
        <button onClick={loadReport} disabled={loading} className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:bg-brand-primary/90 disabled:opacity-50" data-testid="report-load">
          {loading ? 'Cargando...' : 'Generar Reporte'}
        </button>
        <button onClick={exportCSV} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded-lg hover:bg-gray-50" data-testid="report-export">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* Results */}
      {tab === 'stock' && stockData && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-left">Ubicación</th>
                <th className="px-4 py-3 text-right">Cantidad</th>
                <th className="px-4 py-3 text-right">Umbral</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stockData.map((r, i) => (
                <tr key={i} className={r.isLow ? 'bg-red-50' : ''}>
                  <td className="px-4 py-3 font-medium">{r.productName}</td>
                  <td className="px-4 py-3 text-gray-500">{r.locationName}</td>
                  <td className="px-4 py-3 text-right font-medium">{r.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{r.threshold}</td>
                  <td className="px-4 py-3 text-center">{r.isLow ? <span className="text-xs text-red-600 font-medium">⚠ Bajo</span> : <span className="text-xs text-green-600">OK</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'sales' && salesData && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{salesData.totalOrderCount}</p>
              <p className="text-xs text-gray-500">Pedidos</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-700">S/ {(salesData.totalRevenueCents / 100).toFixed(2)}</p>
              <p className="text-xs text-gray-500">Ingresos</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">S/ {(salesData.averageTicketCents / 100).toFixed(2)}</p>
              <p className="text-xs text-gray-500">Ticket promedio</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr><th className="px-4 py-3 text-left">Fecha</th><th className="px-4 py-3 text-right">Pedidos</th><th className="px-4 py-3 text-right">Ingresos</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {salesData.ordersByDay.map((d) => (
                  <tr key={d.date}><td className="px-4 py-2">{d.date}</td><td className="px-4 py-2 text-right">{d.count}</td><td className="px-4 py-2 text-right font-medium">S/ {(d.revenueCents / 100).toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'production' && productionData && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold">{productionData.totalOrders}</p><p className="text-xs text-gray-500">Órdenes</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{productionData.totalProducedKg.toFixed(1)} kg</p><p className="text-xs text-gray-500">Producido</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{productionData.totalWasteKg.toFixed(1)} kg</p><p className="text-xs text-gray-500">Merma</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold">{productionData.averageWastePercent.toFixed(1)}%</p><p className="text-xs text-gray-500">% Merma</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr><th className="px-4 py-3 text-left">Proceso</th><th className="px-4 py-3 text-right">Órdenes</th><th className="px-4 py-3 text-right">Producido</th><th className="px-4 py-3 text-right">Merma</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {productionData.byProcess.map((p) => (
                  <tr key={p.process}><td className="px-4 py-2 font-medium">{p.process}</td><td className="px-4 py-2 text-right">{p.count}</td><td className="px-4 py-2 text-right">{p.producedKg.toFixed(1)} kg</td><td className="px-4 py-2 text-right text-red-600">{p.wasteKg.toFixed(1)} kg</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
