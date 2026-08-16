// Levenshtein distance spelling tolerance checker
// Matches user words to correct lyrics with a 75% similarity threshold

export function calculateLevenshteinDistance(a, b) {
  const matrix = [];
  
  // Clean inputs to ensure we don't count trailing spaces or weird formatting
  a = a.trim();
  b = b.trim();

  // If one of them is empty
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1  // deletion
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function isWordCorrect(userWord, targetWord) {
  if (!userWord && !targetWord) return true;
  if (!userWord || !targetWord) return false;

  // Normalize: lower case, strip all punctuation/apostrophes/commas and standard symbols
  // Keep only alphanumeric characters
  const cleanUser = userWord.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanTarget = targetWord.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (cleanUser === cleanTarget) return true;
  if (cleanUser.length === 0 || cleanTarget.length === 0) return false;

  const distance = calculateLevenshteinDistance(cleanUser, cleanTarget);
  const maxLength = Math.max(cleanUser.length, cleanTarget.length);
  const similarity = 1 - (distance / maxLength);

  return similarity >= 0.75;
}

export function verifyAnswers(userAnswers, targetWords) {
  // Checks a full array of answers against target words.
  // Both must have the same length.
  if (!userAnswers || !targetWords || userAnswers.length !== targetWords.length) {
    return false;
  }
  return userAnswers.every((ans, idx) => isWordCorrect(ans, targetWords[idx]));
}
