import { StoryGenre } from "@/lib/types";

const storyGenres: StoryGenre[] = [
  {
    id: "fantasy",
    name: "Fantasy", 
    description: "Dragons, magic, enchanted realms",
    icon: "✨",
    gradient: "from-purple-500 to-pink-500"
  },
  {
    id: "adventure",
    name: "Adventure",
    description: "Journeys, exploration, discovery", 
    icon: "🧭",
    gradient: "from-blue-500 to-teal-500"
  },
  {
    id: "mystery",
    name: "Mystery",
    description: "Puzzles, secrets, intrigue",
    icon: "🔍", 
    gradient: "from-indigo-500 to-purple-600"
  },
  {
    id: "peaceful",
    name: "Peaceful",
    description: "Calm, meditative, soothing",
    icon: "🍃",
    gradient: "from-green-500 to-blue-400"
  }
];

interface StorySelectorProps {
  selectedGenre?: string;
  onGenreSelect: (genre: string) => void;
}

export default function StorySelector({ selectedGenre, onGenreSelect }: StorySelectorProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-light text-center">Choose Your Dream Journey</h2>
      
      <div className="grid gap-4 md:grid-cols-2 max-w-xl mx-auto">
        {storyGenres.map((genre) => (
          <button
            key={genre.id}
            onClick={() => onGenreSelect(genre.id)}
            className={`genre-btn group bg-card/50 hover:bg-card border border-border hover:border-primary/50 rounded-2xl p-6 transition-all duration-300 text-left ${
              selectedGenre === genre.id ? 'selected' : ''
            }`}
          >
            <div className="flex items-center space-x-4">
              <div className={`w-12 h-12 bg-gradient-to-br ${genre.gradient} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform text-xl`}>
                {genre.icon}
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground">{genre.name}</h3>
                <p className="text-sm text-muted-foreground">{genre.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
