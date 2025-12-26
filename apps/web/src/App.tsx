/**
 * App - Root Application Component
 *
 * Thin wrapper that renders the TaggingPageContainer.
 * All business logic, state management, and layout are delegated to sub-components.
 */

import { TaggingPageContainer } from './pages/TaggingPageContainer';

function App() {
  return <TaggingPageContainer />;
}

export default App;
