import Card from '@/components/ui/Card';

export default function RulesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 font-serif">League Rules</h1>
        <p className="text-sm text-gray-500">
          Everything you need to know about Lumberjacks Fantasy Golf
        </p>
      </div>

      {/* How It Works */}
      <Card goldBorder>
        <div className="p-6 space-y-3">
          <h2 className="text-lg font-bold text-augusta-green">How It Works</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Before each PGA tournament, the league holds a <strong>snake draft</strong> where each
            player drafts <strong>7 golfers</strong> from the tournament field. After the tournament,
            your <strong>best 4 scores</strong> (to par) count toward your team total. Lowest total wins the week.
          </p>
        </div>
      </Card>

      {/* Snake Draft */}
      <Card>
        <div className="p-6 space-y-3">
          <h2 className="text-lg font-bold text-augusta-green">Snake Draft</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-augusta-gold flex-shrink-0" />
              <span>Each tournament starts with a <strong>7-round snake draft</strong>. Every player picks one golfer per round.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-augusta-gold flex-shrink-0" />
              <span>Odd rounds go in order (1 &rarr; 2 &rarr; 3 &rarr; 4). Even rounds reverse (4 &rarr; 3 &rarr; 2 &rarr; 1).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-augusta-gold flex-shrink-0" />
              <span>Week 1 draft order is randomized. After that, the player in last place picks first.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-augusta-gold flex-shrink-0" />
              <span>Once a golfer is drafted, no one else can pick them that week.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-augusta-gold flex-shrink-0" />
              <span>The draft must be completed before the first round tee time on Thursday.</span>
            </li>
          </ul>
        </div>
      </Card>

      {/* Scoring */}
      <Card>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-augusta-green">Weekly Scoring</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Of your 7 drafted golfers, only the <strong>best 4 scores</strong> (lowest score-to-par) count.
            The other 3 are dropped. Your team total is the sum of those 4 scores.
          </p>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Example
            </p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-900">
                <span>Golfer A</span>
                <span className="font-medium text-augusta-green">-8</span>
              </div>
              <div className="flex justify-between text-gray-900">
                <span>Golfer B</span>
                <span className="font-medium text-augusta-green">-5</span>
              </div>
              <div className="flex justify-between text-gray-900">
                <span>Golfer C</span>
                <span className="font-medium text-augusta-green">-3</span>
              </div>
              <div className="flex justify-between text-gray-900">
                <span>Golfer D</span>
                <span className="font-medium text-augusta-green">-1</span>
              </div>
              <div className="flex justify-between text-gray-400 line-through">
                <span>Golfer E</span>
                <span>+2</span>
              </div>
              <div className="flex justify-between text-gray-400 line-through">
                <span>Golfer F</span>
                <span>+5</span>
              </div>
              <div className="flex justify-between text-gray-400 line-through">
                <span>Golfer G</span>
                <span>CUT</span>
              </div>
              <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-bold text-gray-900">
                <span>Team Total (Best 4)</span>
                <span className="text-augusta-green">-17</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Points System */}
      <Card>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-augusta-green">Points System</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Teams are ranked each week by total score. Points are awarded based on finishing position:
          </p>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-augusta-green text-white">
                  <th className="px-4 py-2.5 text-left font-semibold">Position</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-augusta-gold/10">
                  <td className="px-4 py-2.5 font-medium">1st Place</td>
                  <td className="px-4 py-2.5 text-right font-bold text-augusta-green">200</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium">2nd Place</td>
                  <td className="px-4 py-2.5 text-right font-bold text-gray-700">100</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium">3rd Place</td>
                  <td className="px-4 py-2.5 text-right font-bold text-gray-700">50</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium">4th Place</td>
                  <td className="px-4 py-2.5 text-right font-bold text-gray-400">0</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Tiebreakers */}
      <Card>
        <div className="p-6 space-y-3">
          <h2 className="text-lg font-bold text-augusta-green">Tiebreaker Rules</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            When two or more teams finish with the same total score, the points for
            the tied positions are <strong>combined and split equally</strong>.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 space-y-2">
            <p className="font-medium">Example: Two teams tied for 1st place</p>
            <p>
              1st place (200 pts) + 2nd place (100 pts) = 300 pts total
            </p>
            <p>
              Each tied team receives <strong>150 points</strong>.
            </p>
          </div>
        </div>
      </Card>

      {/* Season Standings */}
      <Card>
        <div className="p-6 space-y-3">
          <h2 className="text-lg font-bold text-augusta-green">Season Standings</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Season standings are determined by <strong>cumulative points</strong> across all
            tournaments. The player with the most total points at the end of the season
            wins the league championship. 🪓
          </p>
        </div>
      </Card>

      {/* Join League */}
      <Card goldBorder>
        <div className="p-6 text-center space-y-2">
          <p className="text-xs font-semibold text-augusta-gold uppercase tracking-wider">
            Join the League
          </p>
          <p className="text-sm text-gray-600">
            Go to <a href="/leagues" className="text-augusta-green font-medium hover:underline">Leagues</a> and enter the invite code:
          </p>
          <p className="text-2xl font-mono font-bold text-augusta-green tracking-widest">LUMBER2026</p>
        </div>
      </Card>
    </div>
  );
}
