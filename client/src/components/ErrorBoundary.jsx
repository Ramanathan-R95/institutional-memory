import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error(error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-[50vh] place-items-center p-6 text-center">
        <div>
          <h1 className="text-xl font-extrabold">Something went wrong</h1>
          <p className="mt-1 text-sm text-slate-500">This page hit an unexpected error.</p>
          <button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </div>
    );
  }
}