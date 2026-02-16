export default function BookingPreview({ data, stage }) {
  const completionPercentage = calculateCompletion(data);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 sticky top-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          Booking Progress
        </h3>

        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        <p className="text-sm text-gray-600">{completionPercentage}% Complete</p>
      </div>

      <div className="space-y-3">
        <DataField icon="🎉" label="Event Type" value={data.event_type} />
        <DataField icon="📅" label="Date" value={data.date ? formatDate(data.date) : null} />
        <DataField icon="⏰" label="Time" value={data.time} />
        <DataField icon="📍" label="Location" value={data.location} />
        <DataField icon="💰" label="Budget" value={data.budget ? (typeof data.budget === 'number' ? `₱${data.budget.toLocaleString()}` : data.budget) : null} />
        <DataField icon="👥" label="Guests" value={data.guests} />

        {data.preferences && data.preferences.length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-sm font-medium text-gray-700 mb-2">Preferences:</p>
            <div className="flex flex-wrap gap-2">
              {data.preferences.map((pref, i) => (
                <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {pref}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t">
        <StageIndicator stage={stage} />
      </div>
    </div>
  );
}

function DataField({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xl">{icon}</span>
      <div className="flex-1">
        <p className="text-xs text-gray-500 uppercase">{label}</p>
        {value ? (
          <p className="text-sm font-medium text-gray-900">{value}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">Not provided yet</p>
        )}
      </div>
      {value && <span className="text-green-500">✓</span>}
    </div>
  );
}

function StageIndicator({ stage }) {
  const stages = {
    discovery: { label: 'Gathering Details', color: 'blue' },
    vendor_search: { label: 'Finding Vendors', color: 'purple' },
    confirmation: { label: 'Ready to Book', color: 'green' },
    completed: { label: 'Booking Complete', color: 'green' }
  };

  const current = stages[stage] || stages.discovery;

  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 mb-1">Current Stage</p>
      <span className={`inline-block px-3 py-1 bg-${current.color}-100 text-${current.color}-700 text-sm font-medium rounded-full`}>
        {current.label}
      </span>
    </div>
  );
}

function calculateCompletion(data) {
  const fields = ['event_type', 'date', 'time', 'location', 'budget', 'guests'];
  const filled = fields.filter(field => data[field]).length;
  return Math.round((filled / fields.length) * 100);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}