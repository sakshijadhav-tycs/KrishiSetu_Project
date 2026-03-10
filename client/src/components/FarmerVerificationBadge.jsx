const FarmerVerificationBadge = ({
  verified = false,
  verifiedText = "Verified Farmer",
  unverifiedText = "Unverified Farmer",
  className = "",
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"} ${className}`.trim()}
      title={verified ? verifiedText : unverifiedText}
    >
      <span>{verified ? "✔" : "!"}</span>
      <span>{verified ? verifiedText : unverifiedText}</span>
    </span>
  );
};

export default FarmerVerificationBadge;
