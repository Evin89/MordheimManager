import { strings } from '../strings';

type PlaceholderScreenProps = {
  title: string;
};

export default function PlaceholderScreen({ title }: PlaceholderScreenProps) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-ink-800">
        <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{title}</h1>
      </header>
      <main className="flex-1 px-4 py-6">
        <p className="text-bone-300">{strings.placeholder.comingSoon(title)}</p>
      </main>
    </div>
  );
}
