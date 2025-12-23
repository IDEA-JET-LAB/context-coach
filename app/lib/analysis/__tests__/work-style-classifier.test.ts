/**
 * Work Style Classifier Tests
 * Story 21-2: Work Style Categorization
 *
 * Tests for automatic classification of prompts into 10 work style categories.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyWorkStyle,
  WorkStyleCategory,
  WorkStyleResult,
  WORK_STYLE_CATEGORIES,
} from '../work-style-classifier';

// ============================================================================
// Tests: Type and Structure
// ============================================================================

describe('WorkStyleClassifier Types', () => {
  it('should export 10 work style categories', () => {
    expect(WORK_STYLE_CATEGORIES).toHaveLength(10);
    expect(WORK_STYLE_CATEGORIES).toContain('architecture_questions');
    expect(WORK_STYLE_CATEGORIES).toContain('file_operations');
    expect(WORK_STYLE_CATEGORIES).toContain('debugging');
    expect(WORK_STYLE_CATEGORIES).toContain('agent_delegation');
    expect(WORK_STYLE_CATEGORIES).toContain('testing');
    expect(WORK_STYLE_CATEGORIES).toContain('deployment');
    expect(WORK_STYLE_CATEGORIES).toContain('design_iteration');
    expect(WORK_STYLE_CATEGORIES).toContain('context_recovery');
    expect(WORK_STYLE_CATEGORIES).toContain('quick_commands');
    expect(WORK_STYLE_CATEGORIES).toContain('business_discussion');
  });

  it('should return correct result structure', () => {
    const result = classifyWorkStyle('test prompt');
    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('confidence');
    expect(typeof result.category).toBe('string');
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Tests: Quick Commands (AC #2)
// Priority 100 - Highest priority
// ============================================================================

describe('Quick Commands Classification (AC #2)', () => {
  const quickCommandExamples = [
    'yes',
    'no',
    'ok',
    'okay',
    'y',
    'n',
    '1',
    '2',
    '3',
    'continue',
    'proceed',
    'done',
    'next',
    'go ahead',
    'looks good',
    'lgtm',
    'perfect',
    'great',
    'YES',
    'OK',
    'LGTM',
    'Go Ahead',
  ];

  it.each(quickCommandExamples)(
    'should classify "%s" as quick_commands with 95% confidence',
    (prompt) => {
      const result = classifyWorkStyle(prompt);
      expect(result.category).toBe('quick_commands');
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    }
  );

  it('should handle whitespace around quick commands', () => {
    const result = classifyWorkStyle('  yes  ');
    expect(result.category).toBe('quick_commands');
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('should NOT classify longer sentences starting with "yes" as quick_commands', () => {
    const result = classifyWorkStyle('yes, I want to refactor the authentication module');
    expect(result.category).not.toBe('quick_commands');
  });
});

// ============================================================================
// Tests: Context Recovery (Priority 90)
// ============================================================================

describe('Context Recovery Classification', () => {
  const contextRecoveryExamples = [
    'continued from where we left off',
    'picking up from the last session',
    'context limit reached, continuing',
    'resuming our conversation',
    'where were we',
    'what was I working on',
    'refresh my memory on what we discussed',
    'lets continue where we left off',
    'back to what we were doing',
  ];

  it.each(contextRecoveryExamples)(
    'should classify "%s" as context_recovery',
    (prompt) => {
      const result = classifyWorkStyle(prompt);
      expect(result.category).toBe('context_recovery');
      expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    }
  );
});

// ============================================================================
// Tests: Debugging (AC #3)
// Priority 80
// ============================================================================

describe('Debugging Classification (AC #3)', () => {
  const debuggingExamples = [
    'this is not working',
    'I got an error when running the tests',
    'there is a bug in the login flow',
    'fix this issue with the database',
    'why is it broken',
    'debug this function',
    'troubleshoot the connection problem',
    'why does this fail',
    "why isn't this working",
    'still wrong after the change',
    'still broken, try again',
    'still failing on line 45',
    'the code is throwing an exception',
    'getting TypeError undefined',
  ];

  it.each(debuggingExamples)(
    'should classify "%s" as debugging with 75%+ confidence',
    (prompt) => {
      const result = classifyWorkStyle(prompt);
      expect(result.category).toBe('debugging');
      expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    }
  );
});

// ============================================================================
// Tests: Testing (Priority 70)
// ============================================================================

describe('Testing Classification', () => {
  const testingExamples = [
    'write tests for the user service',
    'add unit tests for this function',
    'run the test suite',
    'fix the failing spec',
    'write e2e tests for login',
    'add playwright tests for the checkout flow',
    'create jest tests for the utils',
    'test coverage is low, add more tests',
    'the integration tests are failing',
    'mock the API in tests',
  ];

  it.each(testingExamples)(
    'should classify "%s" as testing',
    (prompt) => {
      const result = classifyWorkStyle(prompt);
      expect(result.category).toBe('testing');
      expect(result.confidence).toBeGreaterThanOrEqual(0.70);
    }
  );
});

// ============================================================================
// Tests: Deployment (AC #4)
// Priority 70
// ============================================================================

describe('Deployment Classification (AC #4)', () => {
  const deploymentExamples = [
    'deploy this to production',
    'create a docker image',
    'set up the production environment',
    'configure ci/cd pipeline',
    'push to staging',
    'build the docker container',
    'kubernetes deployment manifest',
    'configure nginx for production',
    'set up github actions',
    'create the release',
  ];

  it.each(deploymentExamples)(
    'should classify "%s" as deployment with 80%+ confidence',
    (prompt) => {
      const result = classifyWorkStyle(prompt);
      expect(result.category).toBe('deployment');
      expect(result.confidence).toBeGreaterThanOrEqual(0.80);
    }
  );
});

// ============================================================================
// Tests: Agent Delegation (Priority 60)
// ============================================================================

describe('Agent Delegation Classification', () => {
  const agentDelegationExamples = [
    'you are a senior developer helping me',
    'act as a code reviewer',
    'your role is to be a database expert',
    'pretend you are a security specialist',
    'be a helpful assistant for refactoring',
    'assume the role of architect',
  ];

  it.each(agentDelegationExamples)(
    'should classify "%s" as agent_delegation',
    (prompt) => {
      const result = classifyWorkStyle(prompt);
      expect(result.category).toBe('agent_delegation');
      expect(result.confidence).toBeGreaterThanOrEqual(0.60);
    }
  );
});

// ============================================================================
// Tests: Architecture Questions (Priority 50)
// ============================================================================

describe('Architecture Questions Classification', () => {
  const architectureExamples = [
    'how should I structure this module',
    'what is the best practice for error handling',
    'design a scalable authentication system',
    'should I use microservices or monolith',
    'what architecture pattern fits this use case',
    'recommend a folder structure',
    'how to organize the codebase',
    'best way to handle state management',
  ];

  it.each(architectureExamples)(
    'should classify "%s" as architecture_questions',
    (prompt) => {
      const result = classifyWorkStyle(prompt);
      expect(result.category).toBe('architecture_questions');
      expect(result.confidence).toBeGreaterThanOrEqual(0.50);
    }
  );
});

// ============================================================================
// Tests: File Operations (Priority 40)
// ============================================================================

describe('File Operations Classification', () => {
  const fileOperationsExamples = [
    'create a new file called utils.ts',
    'read the package.json file',
    'modify src/components/Button.tsx',
    'delete the old config file',
    'rename main.js to index.js',
    'add a new component in /components',
    'update the README.md',
    'move the file to src/lib',
  ];

  it.each(fileOperationsExamples)(
    'should classify "%s" as file_operations',
    (prompt) => {
      const result = classifyWorkStyle(prompt);
      expect(result.category).toBe('file_operations');
      expect(result.confidence).toBeGreaterThanOrEqual(0.40);
    }
  );
});

// ============================================================================
// Tests: Design Iteration (Priority 40)
// ============================================================================

describe('Design Iteration Classification', () => {
  const designIterationExamples = [
    'make it larger',
    'change the color to blue',
    'update the ui layout',
    'adjust the spacing between elements',
    'make the button more prominent',
    'center the text',
    'add some padding',
    'fix the alignment',
    'make it responsive',
    'improve the visual design',
  ];

  it.each(designIterationExamples)(
    'should classify "%s" as design_iteration',
    (prompt) => {
      const result = classifyWorkStyle(prompt);
      expect(result.category).toBe('design_iteration');
      expect(result.confidence).toBeGreaterThanOrEqual(0.40);
    }
  );
});

// ============================================================================
// Tests: Business Discussion (Priority 30)
// ============================================================================

describe('Business Discussion Classification', () => {
  const businessDiscussionExamples = [
    'what pricing model should we use',
    'how many users do we have',
    'strategy for customer acquisition',
    'roadmap for Q1',
    'revenue projections',
    'market analysis',
    'competitive landscape',
    'user feedback summary',
  ];

  it.each(businessDiscussionExamples)(
    'should classify "%s" as business_discussion',
    (prompt) => {
      const result = classifyWorkStyle(prompt);
      expect(result.category).toBe('business_discussion');
      expect(result.confidence).toBeGreaterThanOrEqual(0.30);
    }
  );
});

// ============================================================================
// Tests: Default Classification (AC #6)
// ============================================================================

describe('Default Classification (AC #6)', () => {
  const ambiguousExamples = [
    'help me with something',
    'what do you think',
    'can you assist',
    'random text here',
    'lorem ipsum dolor',
    'general question about coding',
  ];

  it.each(ambiguousExamples)(
    'should classify ambiguous prompt "%s" as file_operations with 30% confidence',
    (prompt) => {
      const result = classifyWorkStyle(prompt);
      expect(result.category).toBe('file_operations');
      expect(result.confidence).toBe(0.30);
    }
  );
});

// ============================================================================
// Tests: Performance (AC #5)
// ============================================================================

describe('Performance (AC #5)', () => {
  it('should classify prompts in under 5ms', () => {
    const testPrompts = [
      'yes',
      'this is not working and I need help debugging',
      'deploy to production',
      'write tests for the authentication module',
      'how should I structure the database schema',
      'some random text that matches nothing specific',
    ];

    for (const prompt of testPrompts) {
      const start = performance.now();
      classifyWorkStyle(prompt);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(5);
    }
  });

  it('should handle very long prompts efficiently', () => {
    const longPrompt = 'help me fix this bug '.repeat(100);
    const start = performance.now();
    classifyWorkStyle(longPrompt);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(5);
  });

  it('should classify 100 prompts in under 100ms total (avg <1ms)', () => {
    const prompts = [
      'yes',
      'no',
      'fix this bug',
      'deploy to prod',
      'write tests',
      'create file.ts',
      'make it blue',
      'user count',
      'where were we',
      'you are a developer',
    ];

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      classifyWorkStyle(prompts[i % prompts.length]!);
    }
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });
});

// ============================================================================
// Tests: Priority Ordering
// ============================================================================

describe('Priority Ordering', () => {
  it('should prioritize quick_commands over debugging', () => {
    // "yes" could theoretically match debugging patterns if poorly designed
    const result = classifyWorkStyle('yes');
    expect(result.category).toBe('quick_commands');
  });

  it('should prioritize debugging over testing when both match', () => {
    // "test is broken" contains both "test" and "broken"
    const result = classifyWorkStyle('the test is broken and not working');
    expect(result.category).toBe('debugging');
  });

  it('should prioritize deployment over file_operations', () => {
    // "create docker file" has both "create" (file ops) and "docker" (deployment)
    const result = classifyWorkStyle('create the docker deployment file');
    expect(result.category).toBe('deployment');
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty strings', () => {
    const result = classifyWorkStyle('');
    expect(result.category).toBe('file_operations');
    expect(result.confidence).toBe(0.30);
  });

  it('should handle whitespace-only strings', () => {
    const result = classifyWorkStyle('   \t\n   ');
    expect(result.category).toBe('file_operations');
    expect(result.confidence).toBe(0.30);
  });

  it('should handle special characters', () => {
    const result = classifyWorkStyle('fix the bug!!! @#$%');
    expect(result.category).toBe('debugging');
  });

  it('should be case insensitive', () => {
    expect(classifyWorkStyle('YES').category).toBe('quick_commands');
    expect(classifyWorkStyle('NOT WORKING').category).toBe('debugging');
    expect(classifyWorkStyle('DEPLOY').category).toBe('deployment');
  });

  it('should handle unicode characters', () => {
    const result = classifyWorkStyle('fix the bug with emoji 🐛');
    expect(result.category).toBe('debugging');
  });
});

// ============================================================================
// Tests: Real-World Prompt Examples
// ============================================================================

describe('Real-World Prompt Examples', () => {
  it('should classify complex debugging prompt', () => {
    const result = classifyWorkStyle(
      'The API endpoint is returning a 500 error when I try to create a new user. Can you help me debug this?'
    );
    expect(result.category).toBe('debugging');
  });

  it('should classify architecture discussion', () => {
    const result = classifyWorkStyle(
      'How should I design the database schema for a multi-tenant SaaS application?'
    );
    expect(result.category).toBe('architecture_questions');
  });

  it('should classify deployment task', () => {
    const result = classifyWorkStyle(
      'Set up a GitHub Actions workflow to automatically deploy to AWS on merge to main'
    );
    expect(result.category).toBe('deployment');
  });

  it('should classify testing request', () => {
    const result = classifyWorkStyle(
      'Add comprehensive unit tests for the payment processing module using Jest'
    );
    expect(result.category).toBe('testing');
  });

  it('should classify file operation request', () => {
    const result = classifyWorkStyle(
      'Create a new React component for the dashboard sidebar at components/dashboard/Sidebar.tsx'
    );
    expect(result.category).toBe('file_operations');
  });
});
