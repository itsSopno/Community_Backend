import { Request, Response } from 'express';
import { asyncHandler, sendSuccess, sendError } from '../utils/response';

// Mock AI responses for when Gemini API is unavailable
const MOCK_RESPONSES: Record<string, object> = {
    default: {
        description:
            'Join us for an exciting community initiative that brings people together to make a real difference. ' +
            'This event focuses on collaboration, skill-sharing, and positive impact. ' +
            'Volunteers will work alongside experienced coordinators to achieve meaningful outcomes for our community.',
        volunteerRoles: ['Team Coordinator', 'Field Volunteer', 'Logistics Support', 'Public Relations'],
        requiredSkills: ['Teamwork', 'Communication', 'Physical Fitness', 'Time Management'],
        promotionalMessage:
            '🌟 Be the change! Join our community event and help create a lasting impact. ' +
            'Together we can make our neighborhood a better place. Register now!',
    },
};

const generateMockResponse = (idea: string) => {
    const lowerIdea = idea.toLowerCase();
    if (lowerIdea.includes('tree') || lowerIdea.includes('plant') || lowerIdea.includes('environment')) {
        return {
            description:
                `A wonderful effort to restore greenery in our community through a tree plantation drive. ` +
                `Volunteers will plant native trees, learn about local ecology, and contribute to a healthier environment. ` +
                `Together we can fight climate change one tree at a time!`,
            volunteerRoles: ['Tree Planting Crew', 'Soil Preparation Team', 'Seedling Handler', 'Site Coordinator'],
            requiredSkills: ['Physical Fitness', 'Environmental Awareness', 'Teamwork', 'Basic Gardening'],
            promotionalMessage:
                '🌳 Plant a tree, grow a future! Join our tree plantation program and help turn our city green. Every tree counts!',
        };
    }
    if (lowerIdea.includes('clean') || lowerIdea.includes('trash') || lowerIdea.includes('litter')) {
        return {
            description:
                `A community cleanup drive to restore the beauty and hygiene of our public spaces. ` +
                `Volunteers will collect litter, sort recyclables, and help educate the community about waste management.`,
            volunteerRoles: ['Cleanup Crew Leader', 'Waste Sorter', 'Awareness Volunteer', 'Equipment Manager'],
            requiredSkills: ['Physical Activity', 'Environmental Consciousness', 'Teamwork', 'Attention to Detail'],
            promotionalMessage: '🗑️ Cleaner streets, happier hearts! Join our cleanup drive this weekend!',
        };
    }
    if (lowerIdea.includes('education') || lowerIdea.includes('teach') || lowerIdea.includes('school')) {
        return {
            description:
                `An education outreach program designed to provide quality learning opportunities to underserved students. ` +
                `Volunteer teachers and mentors will conduct engaging classes, workshops, and skill-building sessions.`,
            volunteerRoles: ['Subject Teacher', 'Mentor', 'Workshop Facilitator', 'Program Coordinator'],
            requiredSkills: ['Teaching', 'Subject Expertise', 'Patience', 'Communication', 'Curriculum Planning'],
            promotionalMessage: '📚 Education changes lives! Volunteer as a teacher and help shape the future of our children.',
        };
    }
    if (lowerIdea.includes('health') || lowerIdea.includes('medical') || lowerIdea.includes('blood')) {
        return {
            description:
                `A community health camp providing free medical checkups, consultations, and awareness sessions. ` +
                `Medical volunteers and health professionals will serve the community with essential health services.`,
            volunteerRoles: ['Medical Professional', 'Health Screener', 'Patient Coordinator', 'Awareness Educator'],
            requiredSkills: ['Medical Knowledge', 'First Aid', 'Empathy', 'Communication', 'Organization'],
            promotionalMessage: '❤️ Your health matters! Free medical camp this weekend — bring your family!',
        };
    }
    return MOCK_RESPONSES.default;
};

// ─── Generate Event Content (AI Assistant) ────────────────────────────────────
export const generateEventContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { idea } = req.body;

    if (!idea || idea.trim().length < 5) {
        sendError(res, 'Please provide a meaningful event idea (at least 5 characters).', 400);
        return;
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Try live Gemini API if key is provided
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
        try {
            const prompt = `You are an event planning assistant. Based on the following event idea, generate structured content for a community event.

Event Idea: "${idea}"

Provide a JSON response with exactly these fields:
{
  "description": "A compelling 2-3 sentence event description",
  "volunteerRoles": ["role1", "role2", "role3", "role4"],
  "requiredSkills": ["skill1", "skill2", "skill3", "skill4"],
  "promotionalMessage": "A short, engaging promotional message with relevant emoji"
}

Make the content practical, community-focused, and inspiring. Return only valid JSON.`;

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
                    }),
                }
            );

            if (response.ok) {
                const data = await response.json() as {
                    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
                };
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    sendSuccess(res, { ...parsed, source: 'gemini' }, 'Content generated successfully');
                    return;
                }
            }
        } catch (err) {
            console.warn('Gemini API failed, falling back to mock:', err);
        }
    }

    // Fallback: mock response
    const mockData = generateMockResponse(idea.trim());
    sendSuccess(res, { ...mockData, source: 'mock' }, 'Content generated (mock mode)');
});
