import CustomerForm from "./components/CustomerForm";

function CustomerCreatePage() {
  return (
    <div className="space-y-5">
      <CustomerForm mode="create" />
    </div>
  );
}

export default CustomerCreatePage;
