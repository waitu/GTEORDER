import { AdminLayout } from '../../components/AdminLayout';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';

const mockPlans = [
  { name: 'Standard', price: '$9.99', limits: 'Up to 1,000 trackings/month' },
  { name: 'Pro', price: '$29.00', limits: 'Up to 10,000 trackings/month' },
  { name: 'Enterprise', price: 'Custom', limits: 'Unlimited trackings with SLA' },
];

export const PricingManagementPage = () => (
  <AdminLayout title="Pricing Management">
    <Card title="Plans" description="Placeholder UI. Wire to real pricing service when ready.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {mockPlans.map((plan) => (
          <Card key={plan.name} className="bg-slate-50" title={plan.name} description={plan.limits}>
            <p className="text-2xl font-bold text-slate-900">{plan.price}</p>
            <div className="mt-3 flex items-center justify-between">
              <Badge variant={plan.price === 'Custom' ? 'info' : 'neutral'}>{plan.price === 'Custom' ? 'Contact sales' : 'Public'}</Badge>
              <div className="space-x-2 text-xs">
                <button className="rounded-md border border-slate-200 px-3 py-1 font-semibold text-slate-700">Edit</button>
                <button className="rounded-md bg-slate-900 px-3 py-1 font-semibold text-white">Preview</button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  </AdminLayout>
);
