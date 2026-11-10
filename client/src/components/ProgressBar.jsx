export default function ProgressBar({ percent }) {
  return (
    <div className="mb-8">
      <div className="progress-bar">
        <div id="progress-fill" className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="flex justify-between text-sm text-gray-600 mt-2">
        <span>Search</span>
        <span>Select Room</span>
        <span>Guest Details</span>
        <span>Payment</span>
        <span>Confirmation</span>
      </div>
    </div>
  );
}
