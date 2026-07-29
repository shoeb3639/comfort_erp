import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  MapPin,
  ReceiptText,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import {
  createBankAccount,
  createLocation,
  getBankAccounts,
  getCompanyProfile,
  getInvoiceSettings,
  getLocations,
  getOnboarding,
  getSetupErrorMessage,
  getTaxSettings,
  updateBankAccount,
  updateCompanyProfile,
  updateInvoiceSettings,
  updateLocation,
  updateTaxSettings,
} from "../../services/tenantSetup";

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const setupLinks = [
  {
    title: "GST Registrations",
    to: "/settings/gst-registrations",
    icon: ReceiptText,
  },
  { title: "Tenant Users", to: "/settings/users", icon: Users },
  { title: "Roles", to: "/settings/roles", icon: ShieldCheck },
  { title: "Permissions", to: "/settings/permissions", icon: CheckCircle2 },
];

function TextField({ label, onChange, ...props }) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className={fieldClass}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </label>
  );
}

function SetupSection({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SettingsPage() {
  const [profile, setProfile] = useState(null);
  const [tax, setTax] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [locations, setLocations] = useState([]);
  const [banks, setBanks] = useState([]);
  const [onboarding, setOnboarding] = useState(null);
  const [locationForm, setLocationForm] = useState({
    name: "",
    code: "",
    city: "",
    state: "",
    isPrimary: false,
  });
  const [bankForm, setBankForm] = useState({
    accountName: "",
    bankName: "",
    branchName: "",
    accountNumber: "",
    ifscCode: "",
    accountType: "Current",
    isDefault: false,
  });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [
      profileData,
      taxData,
      invoiceData,
      locationData,
      bankData,
      onboardingData,
    ] = await Promise.all([
      getCompanyProfile(),
      getTaxSettings(),
      getInvoiceSettings(),
      getLocations(),
      getBankAccounts(),
      getOnboarding(),
    ]);
    setProfile(profileData);
    setTax({
      ...taxData,
      gstEnabled: taxData.taxSettings?.gstEnabled ?? true,
      defaultTaxRate: taxData.taxSettings?.defaultTaxRate ?? 5,
      hsnSacCode: taxData.taxSettings?.hsnSacCode ?? "9964",
    });
    setInvoice({
      ...invoiceData,
      paymentTerms:
        invoiceData.invoiceSettings?.paymentTerms ?? "Due on receipt",
      footerNote: invoiceData.invoiceSettings?.footerNote ?? "",
      authorizedSignatory:
        invoiceData.invoiceSettings?.authorizedSignatory ?? "",
    });
    setLocations(locationData);
    setBanks(bankData);
    setOnboarding(onboardingData);
  }

  useEffect(() => {
    load().catch((requestError) =>
      setError(getSetupErrorMessage(requestError)),
    );
  }, []);

  async function run(action, message) {
    setError("");
    setNotice("");
    try {
      await action();
      await load();
      setNotice(message);
    } catch (requestError) {
      setError(getSetupErrorMessage(requestError));
    }
  }

  if (!profile || !tax || !invoice) {
    return (
      <div className="rounded-2xl bg-white p-6 text-sm text-slate-600">
        Loading company setup…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
              Phase 3
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-950">
              Company Setup
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Database-backed tenant profile, compliance, invoicing, banking,
              locations, and access control.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Onboarding
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {onboarding?.onboardingStatus?.replaceAll("_", " ")}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {onboarding?.onboardingItems?.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${item.isCompleted ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}
            >
              {item.isCompleted ? "✓ " : ""}
              {item.label}
            </div>
          ))}
        </div>
      </section>

      {notice && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {setupLinks.map(({ title, to, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-200"
          >
            <Icon size={20} className="text-brand-600" />
            <p className="mt-3 font-semibold text-slate-900">{title}</p>
          </Link>
        ))}
      </section>

      <SetupSection
        title="Prefix Settings"
        description="Central numbering and communication prefixes used across Booking, Invoice, and SMS workflows."
      >
        <form
          className="grid gap-4 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () =>
                updateCompanyProfile({
                  bookingPrefix: profile.bookingPrefix || null,
                  invoicePrefix: profile.invoicePrefix || null,
                  smsPrefix: profile.smsPrefix || null,
                }),
              "Prefix settings saved.",
            );
          }}
        >
          <TextField
            label="Booking Prefix"
            required
            minLength="4"
            maxLength="4"
            pattern="[A-Z0-9]{4}"
            placeholder="CMFP"
            value={profile.bookingPrefix || ""}
            onChange={(value) =>
              setProfile({
                ...profile,
                bookingPrefix: value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 4),
              })
            }
          />
          <TextField
            label="Invoice Prefix"
            maxLength="30"
            placeholder="INV"
            value={profile.invoicePrefix || ""}
            onChange={(value) =>
              setProfile({
                ...profile,
                invoicePrefix: value.toUpperCase(),
              })
            }
          />
          <TextField
            label="SMS Prefix"
            minLength="2"
            maxLength="12"
            pattern="[A-Z0-9]{2,12}"
            placeholder="CABLIX"
            value={profile.smsPrefix || ""}
            onChange={(value) =>
              setProfile({
                ...profile,
                smsPrefix: value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 12),
              })
            }
          />
          <div className="md:col-span-3">
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
              Save Prefix Settings
            </button>
          </div>
        </form>
      </SetupSection>

      <SetupSection
        title="Company Profile"
        description="Legal identity, contact details, registered address, and operational defaults."
      >
        <form
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () =>
                updateCompanyProfile({
                  legalName: profile.legalName,
                  tradeName: profile.tradeName,
                  businessType: profile.businessType,
                  email: profile.email,
                  mobile: profile.mobile,
                  alternateNumber: profile.alternateNumber,
                  website: profile.website,
                  logoUrl: profile.logoUrl,
                  addressLine1: profile.addressLine1,
                  addressLine2: profile.addressLine2,
                  city: profile.city,
                  state: profile.state,
                  pinCode: profile.pinCode,
                  country: profile.country,
                  defaultCurrency: profile.defaultCurrency,
                  timeZone: profile.timeZone,
                  financialYearStartMonth: Number(
                    profile.financialYearStartMonth,
                  ),
                  dateFormat: profile.dateFormat,
                }),
              "Company profile saved.",
            );
          }}
        >
          <TextField
            label="Legal Name"
            required
            value={profile.legalName || ""}
            onChange={(value) => setProfile({ ...profile, legalName: value })}
          />
          <TextField
            label="Trade Name"
            value={profile.tradeName || ""}
            onChange={(value) => setProfile({ ...profile, tradeName: value })}
          />
          <TextField
            label="Business Type"
            value={profile.businessType || ""}
            onChange={(value) =>
              setProfile({ ...profile, businessType: value })
            }
          />
          <TextField
            label="Email"
            type="email"
            required
            value={profile.email || ""}
            onChange={(value) => setProfile({ ...profile, email: value })}
          />
          <TextField
            label="Mobile"
            required
            value={profile.mobile || ""}
            onChange={(value) => setProfile({ ...profile, mobile: value })}
          />
          <TextField
            label="Website"
            value={profile.website || ""}
            onChange={(value) => setProfile({ ...profile, website: value })}
          />
          <TextField
            label="Address Line 1"
            value={profile.addressLine1 || ""}
            onChange={(value) =>
              setProfile({ ...profile, addressLine1: value })
            }
          />
          <TextField
            label="City"
            value={profile.city || ""}
            onChange={(value) => setProfile({ ...profile, city: value })}
          />
          <TextField
            label="State"
            value={profile.state || ""}
            onChange={(value) => setProfile({ ...profile, state: value })}
          />
          <TextField
            label="PIN Code"
            value={profile.pinCode || ""}
            onChange={(value) => setProfile({ ...profile, pinCode: value })}
          />
          <TextField
            label="Time Zone"
            value={profile.timeZone || ""}
            onChange={(value) => setProfile({ ...profile, timeZone: value })}
          />
          <TextField
            label="Currency"
            value={profile.defaultCurrency || ""}
            onChange={(value) =>
              setProfile({ ...profile, defaultCurrency: value.toUpperCase() })
            }
          />
          <div className="md:col-span-2 xl:col-span-3">
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
              Save Company Profile
            </button>
          </div>
        </form>
      </SetupSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <SetupSection
          title="Tax Settings"
          description="Tenant-level GST and default tax calculation settings."
        >
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              run(
                () =>
                  updateTaxSettings({
                    gstin: tax.gstin,
                    pan: tax.pan,
                    companyRegistrationNumber: tax.companyRegistrationNumber,
                    stateCode: tax.stateCode,
                    taxRegistrationType: tax.taxRegistrationType,
                    taxSettings: {
                      gstEnabled: tax.gstEnabled,
                      defaultTaxRate: Number(tax.defaultTaxRate),
                      hsnSacCode: tax.hsnSacCode,
                    },
                  }),
                "Tax settings saved.",
              );
            }}
          >
            <TextField
              label="GSTIN"
              value={tax.gstin || ""}
              onChange={(value) =>
                setTax({ ...tax, gstin: value.toUpperCase() })
              }
            />
            <TextField
              label="PAN"
              value={tax.pan || ""}
              onChange={(value) => setTax({ ...tax, pan: value.toUpperCase() })}
            />
            <TextField
              label="State Code"
              value={tax.stateCode || ""}
              onChange={(value) => setTax({ ...tax, stateCode: value })}
            />
            <TextField
              label="Registration Type"
              value={tax.taxRegistrationType || ""}
              onChange={(value) =>
                setTax({ ...tax, taxRegistrationType: value })
              }
            />
            <TextField
              label="Default Tax Rate %"
              type="number"
              min="0"
              max="100"
              value={tax.defaultTaxRate}
              onChange={(value) => setTax({ ...tax, defaultTaxRate: value })}
            />
            <TextField
              label="HSN/SAC Code"
              value={tax.hsnSacCode}
              onChange={(value) => setTax({ ...tax, hsnSacCode: value })}
            />
            <div className="md:col-span-2">
              <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
                Save Tax Settings
              </button>
            </div>
          </form>
        </SetupSection>

        <SetupSection
          title="Invoice Settings"
          description="Invoice series defaults, terms, footer, and signatory."
        >
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              run(
                () =>
                  updateInvoiceSettings({
                    invoiceNumberLength: Number(invoice.invoiceNumberLength),
                    invoiceSettings: {
                      paymentTerms: invoice.paymentTerms,
                      footerNote: invoice.footerNote,
                      authorizedSignatory: invoice.authorizedSignatory,
                    },
                  }),
                "Invoice settings saved.",
              );
            }}
          >
            <TextField
              label="Number Length"
              type="number"
              min="1"
              max="12"
              value={invoice.invoiceNumberLength}
              onChange={(value) =>
                setInvoice({ ...invoice, invoiceNumberLength: value })
              }
            />
            <TextField
              label="Payment Terms"
              value={invoice.paymentTerms}
              onChange={(value) =>
                setInvoice({ ...invoice, paymentTerms: value })
              }
            />
            <TextField
              label="Authorized Signatory"
              value={invoice.authorizedSignatory}
              onChange={(value) =>
                setInvoice({ ...invoice, authorizedSignatory: value })
              }
            />
            <label className="md:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                Footer Note
              </span>
              <textarea
                className={fieldClass}
                value={invoice.footerNote}
                onChange={(event) =>
                  setInvoice({ ...invoice, footerNote: event.target.value })
                }
              />
            </label>
            <div className="md:col-span-2">
              <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
                Save Invoice Settings
              </button>
            </div>
          </form>
        </SetupSection>
      </div>

      <SetupSection
        title="Locations"
        description="Branches and operating locations available for users and GST registration mapping."
      >
        <form
          className="grid gap-3 md:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              await createLocation({
                ...locationForm,
                country: "India",
                status: "ACTIVE",
              });
              setLocationForm({
                name: "",
                code: "",
                city: "",
                state: "",
                isPrimary: false,
              });
            }, "Location created.");
          }}
        >
          <TextField
            label="Name"
            required
            value={locationForm.name}
            onChange={(value) =>
              setLocationForm({ ...locationForm, name: value })
            }
          />
          <TextField
            label="Code"
            value={locationForm.code}
            onChange={(value) =>
              setLocationForm({ ...locationForm, code: value.toUpperCase() })
            }
          />
          <TextField
            label="City"
            value={locationForm.city}
            onChange={(value) =>
              setLocationForm({ ...locationForm, city: value })
            }
          />
          <TextField
            label="State"
            value={locationForm.state}
            onChange={(value) =>
              setLocationForm({ ...locationForm, state: value })
            }
          />
          <div className="pt-6">
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
              Add Location
            </button>
          </div>
        </form>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {locations.map((location) => (
            <div
              key={location.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold text-slate-900">
                    {location.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {[location.city, location.state].filter(Boolean).join(", ")}
                  </p>
                </div>
                <MapPin size={18} className="text-brand-600" />
              </div>
              <div className="mt-3 flex gap-2">
                {!location.isPrimary && (
                  <button
                    className="text-xs font-semibold text-brand-600"
                    onClick={() =>
                      run(
                        () => updateLocation(location.id, { isPrimary: true }),
                        "Primary location updated.",
                      )
                    }
                  >
                    Set Primary
                  </button>
                )}
                <button
                  className="text-xs font-semibold text-slate-600"
                  onClick={() =>
                    run(
                      () =>
                        updateLocation(location.id, {
                          status:
                            location.status === "ACTIVE"
                              ? "INACTIVE"
                              : "ACTIVE",
                        }),
                      "Location status updated.",
                    )
                  }
                >
                  {location.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </SetupSection>

      <SetupSection
        title="Bank Accounts"
        description="Company collection accounts displayed on invoices and payment instructions."
      >
        <form
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              await createBankAccount({ ...bankForm, status: "ACTIVE" });
              setBankForm({
                accountName: "",
                bankName: "",
                branchName: "",
                accountNumber: "",
                ifscCode: "",
                accountType: "Current",
                isDefault: false,
              });
            }, "Bank account created.");
          }}
        >
          <TextField
            label="Account Name"
            required
            value={bankForm.accountName}
            onChange={(value) =>
              setBankForm({ ...bankForm, accountName: value })
            }
          />
          <TextField
            label="Bank Name"
            required
            value={bankForm.bankName}
            onChange={(value) => setBankForm({ ...bankForm, bankName: value })}
          />
          <TextField
            label="Account Number"
            required
            value={bankForm.accountNumber}
            onChange={(value) =>
              setBankForm({ ...bankForm, accountNumber: value })
            }
          />
          <TextField
            label="IFSC Code"
            required
            value={bankForm.ifscCode}
            onChange={(value) =>
              setBankForm({ ...bankForm, ifscCode: value.toUpperCase() })
            }
          />
          <div className="xl:col-span-4">
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
              Add Bank Account
            </button>
          </div>
        </form>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {banks.map((bank) => (
            <div
              key={bank.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold text-slate-900">
                    {bank.bankName}
                  </p>
                  <p className="text-sm text-slate-500">
                    {bank.accountName} • {bank.accountNumber}
                  </p>
                  <p className="text-xs text-slate-500">{bank.ifscCode}</p>
                </div>
                <WalletCards size={18} className="text-brand-600" />
              </div>
              <div className="mt-3 flex gap-2">
                {!bank.isDefault && (
                  <button
                    className="text-xs font-semibold text-brand-600"
                    onClick={() =>
                      run(
                        () => updateBankAccount(bank.id, { isDefault: true }),
                        "Default bank updated.",
                      )
                    }
                  >
                    Set Default
                  </button>
                )}
                <button
                  className="text-xs font-semibold text-slate-600"
                  onClick={() =>
                    run(
                      () =>
                        updateBankAccount(bank.id, {
                          status:
                            bank.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                        }),
                      "Bank status updated.",
                    )
                  }
                >
                  {bank.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </SetupSection>
    </div>
  );
}

export default SettingsPage;
