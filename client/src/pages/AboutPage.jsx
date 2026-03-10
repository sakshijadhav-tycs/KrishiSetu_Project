import { Link } from "react-router-dom";

const featureCards = [
  "Multi-Vendor Marketplace",
  "Role-Based Authentication",
  "Order Monitoring Dashboard",
  "Razorpay Integration",
  "COD Support",
  "Automated Invoice & Receipt Generation",
  "Commission Tracking System",
];

const techStack = [
  "Node.js",
  "Express.js",
  "MongoDB",
  "Razorpay API",
  "JWT Authentication",
  "PDF Generation",
  "Email Notification System",
];

const AboutPage = () => {
  return (
    <main className="bg-gray-50 text-gray-800">
      <section className="relative overflow-hidden border-b border-green-100 bg-gradient-to-br from-white via-green-50 to-gray-100">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(22,163,74,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(22,163,74,0.06) 1px, transparent 1px)",
            backgroundSize: "38px 38px",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="max-w-4xl animate-fade-in">
            <p className="mb-4 inline-flex rounded-full border border-green-200 bg-green-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-700">
              About KrishiSetu
            </p>
            <h1 className="text-3xl font-bold leading-tight text-gray-900 md:text-5xl">
              Building a Transparent Digital Marketplace for Agriculture
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-relaxed text-gray-600 md:text-lg">
              KrishiSetu is a multi-vendor agri-commerce platform designed to digitize the
              farm-to-customer value chain. We provide secure transactions, role-specific
              workflows, and full order visibility across farmers, customers, and administrators.
            </p>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-600 md:text-lg">
              The platform combines modern payment infrastructure with operational governance so
              agricultural commerce remains efficient, fair, and verifiable.
            </p>
            <div className="mt-8">
              <Link
                to="/products"
                className="inline-flex rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
              >
                Explore Marketplace
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <article className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm md:p-10 animate-fade-in">
          <h2 className="text-2xl font-semibold text-gray-900 md:text-3xl">About the Platform</h2>
          <p className="mt-4 leading-relaxed text-gray-600">
            KrishiSetu connects farmers directly with customers through a scalable multi-vendor
            architecture. Farmers onboard independently, manage product catalogs, and process
            orders in a transparent workflow. Customers can evaluate multiple vendors in one
            marketplace, while secure transaction handling and audit-ready order monitoring keep
            operations reliable.
          </p>
        </article>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 md:pb-20">
        <h2 className="text-2xl font-semibold text-gray-900 md:text-3xl">How the Platform Works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm animate-fade-in">
            <h3 className="text-lg font-semibold text-green-700">Farmers</h3>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-gray-600">
              <li>List products with quantity and pricing controls</li>
              <li>Manage order lifecycle and fulfillment updates</li>
              <li>Track settlements through commission-aware records</li>
            </ul>
          </article>
          <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm animate-fade-in animate-delay-100">
            <h3 className="text-lg font-semibold text-green-700">Customers</h3>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-gray-600">
              <li>Browse products from multiple verified farmers</li>
              <li>Complete secure payments via Razorpay</li>
              <li>Choose Cash on Delivery for eligible orders</li>
              <li>Download invoices and payment receipts</li>
            </ul>
          </article>
          <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm animate-fade-in animate-delay-200">
            <h3 className="text-lg font-semibold text-green-700">Admin</h3>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-gray-600">
              <li>Monitor end-to-end order operations</li>
              <li>Manage complaints and issue resolution</li>
              <li>Oversee payment logs and compliance trails</li>
              <li>Maintain governance and platform integrity</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="border-y border-gray-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-2 md:py-20">
          <article className="animate-fade-in">
            <h2 className="text-2xl font-semibold text-gray-900 md:text-3xl">
              Secure Payment & Settlement
            </h2>
            <p className="mt-4 leading-relaxed text-gray-600">
              KrishiSetu integrates Razorpay for secure online payment authorization and settlement
              processing. Each successful transaction is validated using server-side signature
              verification to protect against tampered callbacks and replay attempts.
            </p>
            <p className="mt-4 leading-relaxed text-gray-600">
              The platform generates hybrid invoice and payment receipt documents for complete
              financial traceability. Settlement is commission-based, with role-based access control
              enforcing strict visibility boundaries between consumers, vendors, and administrators.
            </p>
          </article>
          <article className="rounded-xl border border-green-100 bg-green-50 p-6 md:p-8 animate-fade-in animate-delay-100">
            <h3 className="text-lg font-semibold text-green-800">Payment Integrity Controls</h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-green-900">
              <li>Razorpay order and payment ID mapping</li>
              <li>Signature verification before status transition</li>
              <li>Receipt generation after confirmed payment state</li>
              <li>Commission logging for downstream settlement</li>
              <li>Access policies by user role and resource ownership</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <h2 className="text-2xl font-semibold text-gray-900 md:text-3xl">Core Features</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((feature) => (
            <article
              key={feature}
              className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-sm font-medium text-gray-700 shadow-sm transition hover:border-green-300"
            >
              {feature}
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <h2 className="text-2xl font-semibold text-gray-900 md:text-3xl">Technology Stack</h2>
          <div className="mt-8 flex flex-wrap gap-3">
            {techStack.map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 md:pb-24 md:pt-16">
        <article className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm md:p-10 animate-fade-in">
          <h2 className="text-2xl font-semibold text-gray-900 md:text-3xl">Vision</h2>
          <p className="mt-4 leading-relaxed text-gray-600">
            Our vision is to build a scalable and resilient agri-commerce architecture that enables
            sustainable growth for farmers, trusted buying experiences for customers, and a
            transparent digital ecosystem for all stakeholders in the agricultural value chain.
          </p>
        </article>
      </section>
    </main>
  );
};

export default AboutPage;
