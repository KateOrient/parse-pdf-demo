import React from 'react';
import { Document, Page } from 'react-pdf';
import './App.css';
import test from './test.pdf';

class App extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            numPages: null,
            pageNumber: 1,
        };
    }

    onDocumentLoadSuccess({ numPages }) {
        this.setState({ numPages });
    }

    render() {
        const { pageNumber, numPages } = this.state;

        return (
            <div className="App">
                <header className="App-header" />
                <article>
                    <Document file={test}
                              onLoadSuccess={this.onDocumentLoadSuccess}
                    >
                        <Page pageNumber={pageNumber} />
                    </Document>
                </article>
                <footer>
                    <p>Page {pageNumber} of {numPages}</p>
                </footer>
            </div>
        );
    }
}

export {
    App
};
