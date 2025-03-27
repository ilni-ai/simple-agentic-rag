import { useState, useRef, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Spinner, Card } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';

function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const bottomRef = useRef(null);
  const followUpQuery = "Can you provide a step-by-step practical example?";

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/agentic-rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();

      const followUpTriggers = [
        "example", "walkthrough", "demonstration", "step-by-step",
        "scenario", "can be clarified", "want to see how", "let me show", "illustrate"
      ];

      const shouldOfferFollowUp = followUpTriggers.some(kw =>
        data.initialResponse.toLowerCase().includes(kw)
      );

      const newTurn = {
        userQuery: query,
        facts: data.facts,
        response: data.initialResponse,
        showFollowUpButton: shouldOfferFollowUp,
        followUpFacts: [],
        followUpResponse: ''
      };

      setHistory(prev => [...prev, newTurn]);
      setQuery('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUp = async (index) => {
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/agentic-rag/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpQuery }),
      });

      const data = await res.json();

      setHistory(prev =>
        prev.map((turn, i) =>
          i === index
            ? {
                ...turn,
                followUpFacts: data.facts,
                followUpResponse: data.followUpResponse,
                showFollowUpButton: false,
              }
            : turn
        )
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="py-5">
      <Row className="mb-4">
        <Col md={{ span: 8, offset: 2 }}>
          <h2 className="text-center mb-4">Agentic RAG Demo</h2>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Ask a question:</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. What is agentic RAG?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                required
              />
            </Form.Group>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? <Spinner animation="border" size="sm" /> : 'Submit'}
            </Button>
          </Form>
        </Col>
      </Row>

      {history.map((turn, index) => (
        <Row className="mb-4" key={index}>
          <Col md={{ span: 8, offset: 2 }}>
            <Card className="mb-2">
              <Card.Header>User</Card.Header>
              <Card.Body><p>{turn.userQuery}</p></Card.Body>
            </Card>

            <Card className="mb-2">
              <Card.Header>Top Retrieved Facts</Card.Header>
              <Card.Body>
                <ul className="mb-0">
                  {turn.facts.map((fact, idx) => (
                    <li key={idx}>{fact}</li>
                  ))}
                </ul>
              </Card.Body>
            </Card>

            <Card className="mb-2">
              <Card.Header>Gemini Response</Card.Header>
              <Card.Body>
                <ReactMarkdown>{turn.response}</ReactMarkdown>
              </Card.Body>
            </Card>

            {turn.showFollowUpButton && (
              <div className="text-center mb-2">
                <Button
                  variant="outline-secondary"
                  onClick={() => handleFollowUp(index)}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : `Ask Follow-Up: ${followUpQuery}`}
                </Button>
              </div>
            )}

            {turn.followUpResponse && (
              <>
                <Card className="mb-2">
                  <Card.Header>Follow-Up Retrieved Facts</Card.Header>
                  <Card.Body>
                    <ul className="mb-0">
                      {turn.followUpFacts.map((fact, idx) => (
                        <li key={idx}>{fact}</li>
                      ))}
                    </ul>
                  </Card.Body>
                </Card>
                <Card>
                  <Card.Header>Follow-Up Response</Card.Header>
                  <Card.Body>
                    <ReactMarkdown>{turn.followUpResponse}</ReactMarkdown>
                  </Card.Body>
                </Card>
              </>
            )}
          </Col>
        </Row>
      ))}

      <div ref={bottomRef} />
    </Container>
  );
}

export default App;
